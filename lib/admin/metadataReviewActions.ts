"use server";

import { updateTag } from "next/cache";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { refreshSeriesEpisodeStillsAction, type EpisodeStillsResult } from "@/lib/admin/episodeStillsBackfillAction";
import { getSessionUser } from "@/lib/auth/session";
import { assignSeriesToGroup } from "@/lib/seriesGroups/seriesGroupService";
import type { ProviderId } from "@/lib/metadata/types";
import { resolveSeriesIdentity } from "@/lib/metadata/registry";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import type { MetadataReviewItem, MetadataReviewReason } from "@/lib/upload/uploadWorkflowTypes";
import {
    getUploadWorkflowSetup,
    saveSeriesMetadataAction,
} from "@/lib/upload/uploadWorkflowActions";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import { saveReviewDecision, selectSeriesArtwork, undoManualSeriesMetadata } from "@/lib/seriesMetadata/seriesMetadataService";
import { getSeriesMetadata } from "@/lib/seriesMetadata/seriesMetadataService";
import { getProvider } from "@/lib/metadata/registry";
import { searchAdminTmdb, uniqueTmdbMatch } from "@/lib/metadata/searchAdminTmdb";

export const autoFillTmdbAction = async (seriesKey: string): Promise<DataResult<{ status: "saved" | "choose" | "not-found" }>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);
    if (!validKey(seriesKey)) return dataFailure("invalid_response");
    try {
        const existing = await getSeriesMetadata(seriesKey);
        let externalId = existing.externalIds.tmdb;
        if (!externalId) {
            const result = await searchAdminTmdb(seriesKey);
            if (result.kind === "error") return result;
            const match = uniqueTmdbMatch(seriesKey, result.data);
            if (!match) return dataSuccess({ status: result.data.length ? "choose" : "not-found" });
            externalId = match.externalId;
        }
        const provider = getProvider("tmdb");
        if (!provider?.getArtwork) return dataFailure("server");
        const [details, artwork] = await Promise.all([provider.getSeries(externalId), provider.getArtwork(externalId)]);
        if (details.kind === "error") return details;
        if (artwork.kind === "error") return artwork;
        const saved = await persistSeriesIdentity(seriesKey, "tmdb", externalId, details.data, artwork.data, "auto");
        if (!saved) return dataFailure("server");
        await saveReviewDecision(seriesKey, { state: "pending", reason: null });
        updateTag(CATALOG_TAG);
        return dataSuccess({ status: "saved" });
    } catch (error) {
        console.error("autoFillTmdbAction failed", error);
        return dataFailure("server");
    }
};

const validKey = (seriesKey: string) => seriesKey.trim() !== "" && seriesKey.length <= 255;

const withAdminMutation = async (work: () => Promise<void | boolean>): Promise<DataResult<{ success: true }>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);
    try {
        const result = await work();
        if (result === false) return dataFailure("invalid_response");
        updateTag(CATALOG_TAG);
        return dataSuccess({ success: true });
    } catch (error) {
        console.error("metadata mutation failed", error);
        return dataFailure("server");
    }
};

export const refreshMetadataReviewAction = async (): Promise<DataResult<MetadataReviewItem[]>> => {
    const setup = await getUploadWorkflowSetup();
    if (setup.unauthorized) return dataFailure("unauthorized", 401);
    if (setup.unavailable) return dataFailure("network");
    return dataSuccess(setup.metadataReview);
};

export const saveManualMatchAction = async (
    seriesKey: string,
    providerId: ProviderId,
    externalId: string,
): Promise<DataResult<{ success: true }>> => {
    if (!validKey(seriesKey)) return dataFailure("invalid_response");
    const saved = await saveSeriesMetadataAction(seriesKey, providerId, externalId);
    if (saved.kind === "error") return saved;

    await saveReviewDecision(seriesKey, { state: "pending", reason: null });
    updateTag(CATALOG_TAG);
    return dataSuccess({ success: true });
};

export const setMetadataReviewDecisionAction = async (
    seriesKey: string,
    state: "pending" | "skipped",
    reason: MetadataReviewReason | null,
) => {
    if (!validKey(seriesKey)) return dataFailure("invalid_response");
    if (state !== "pending" && state !== "skipped") return dataFailure("invalid_response");
    const savedReason = reason === "missing-poster" ? null : reason;
    return withAdminMutation(() => saveReviewDecision(seriesKey, { state, reason: savedReason }));
};

export const selectSeriesArtworkAction = async (seriesKey: string, artworkId: number) => {
    if (!validKey(seriesKey) || !Number.isSafeInteger(artworkId) || artworkId < 1) {
        return dataFailure("invalid_response");
    }
    return withAdminMutation(() => selectSeriesArtwork(seriesKey, artworkId));
};

export const undoManualMetadataAction = async (seriesKey: string) => {
    if (!validKey(seriesKey)) return dataFailure("invalid_response");
    const undone = await withAdminMutation(() => undoManualSeriesMetadata(seriesKey));
    if (undone.kind === "error") return undone;

    const identity = await resolveSeriesIdentity(seriesKey);
    if (identity.kind === "error") return dataSuccess({ success: true });

    if (identity.data.kind === "matched") {
        await persistSeriesIdentity(
            seriesKey,
            identity.data.providerId,
            identity.data.externalId,
            identity.data.series,
            identity.data.artwork,
            "auto",
        );
    } else {
        await saveReviewDecision(seriesKey, {
            state: "pending",
            reason: identity.data.kind === "ambiguous" ? "partial-match" : "no-match",
        });
    }

    updateTag(CATALOG_TAG);
    return dataSuccess({ success: true });
};

export const correctSeriesSeasonAction = async (
    seriesKey: string,
    groupId: number | null,
    seasonNumber: number,
): Promise<DataResult<EpisodeStillsResult>> => {
    if (
        !validKey(seriesKey)
        || !Number.isSafeInteger(seasonNumber)
        || seasonNumber < 1
        || seasonNumber > 999
    ) return dataFailure("invalid_response");

    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    const assigned = await assignSeriesToGroup(seriesKey, groupId, seasonNumber);
    if (!assigned.ok) {
        return dataFailure(assigned.code === "not_found" ? "invalid_response" : assigned.code === "server" ? "server" : "invalid_response");
    }

    await saveReviewDecision(seriesKey, { state: "pending", reason: null });
    updateTag(CATALOG_TAG);
    return refreshSeriesEpisodeStillsAction(seriesKey, seasonNumber);
};
