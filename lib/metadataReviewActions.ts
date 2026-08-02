"use server";

import { updateTag } from "next/cache";
import { dataFailure, dataSuccess, failureFromStatus, type DataResult } from "@/lib/dataResult";
import { refreshSeriesEpisodeStillsAction, type EpisodeStillsResult } from "@/lib/episodeStillsBackfillAction";
import type { ProviderId } from "@/lib/metadata/types";
import { resolveSeriesIdentity } from "@/lib/metadata/registry";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import type { MetadataReviewItem, MetadataReviewReason } from "@/lib/uploadWorkflowTypes";
import {
    getUploadWorkflowSetup,
    saveSeriesMetadataAction,
} from "@/lib/uploadWorkflowActions";
import { CATALOG_TAG, VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";

const validKey = (seriesKey: string) => seriesKey.trim() !== "" && seriesKey.length <= 255;

const postMetadataReview = async (body: Record<string, unknown>): Promise<DataResult<{ success: true }>> => {
    const headers = await sessionHeaders();
    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/series-metadata.php`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
        });
        if (!response.ok) return failureFromStatus(response.status);
        updateTag(CATALOG_TAG);
        return dataSuccess({ success: true });
    } catch {
        return dataFailure("network");
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

    await postMetadataReview({
        seriesKey,
        reviewDecision: { state: "pending", reason: null },
    });
    updateTag(CATALOG_TAG);
    return dataSuccess({ success: true });
};

export const setMetadataReviewDecisionAction = async (
    seriesKey: string,
    state: "pending" | "skipped",
    reason: MetadataReviewReason | null,
) => {
    if (!validKey(seriesKey)) return dataFailure("invalid_response");
    return postMetadataReview({ seriesKey, reviewDecision: { state, reason } });
};

export const selectSeriesArtworkAction = async (seriesKey: string, artworkId: number) => {
    if (!validKey(seriesKey) || !Number.isSafeInteger(artworkId) || artworkId < 1) {
        return dataFailure("invalid_response");
    }
    return postMetadataReview({ seriesKey, selectArtworkId: artworkId });
};

export const undoManualMetadataAction = async (seriesKey: string) => {
    if (!validKey(seriesKey)) return dataFailure("invalid_response");
    const undone = await postMetadataReview({ seriesKey, undoManual: true });
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
        await postMetadataReview({
            seriesKey,
            reviewDecision: {
                state: "pending",
                reason: identity.data.kind === "ambiguous" ? "partial-match" : "no-match",
            },
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

    const headers = await sessionHeaders();
    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/series-groups.php`, {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ seriesKey, groupId, seasonNumber }),
        });
        if (!response.ok) return failureFromStatus(response.status);
    } catch {
        return dataFailure("network");
    }

    await postMetadataReview({
        seriesKey,
        reviewDecision: { state: "pending", reason: null },
    });
    updateTag(CATALOG_TAG);
    return refreshSeriesEpisodeStillsAction(seriesKey, seasonNumber);
};
