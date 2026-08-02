"use server";

import { updateTag } from "next/cache";
import { getCatalog } from "@/lib/catalog";
import { validateCatalogResponse } from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";
import { getProvider, searchIdentityCandidates } from "@/lib/metadata/registry";
import type { ProviderId } from "@/lib/metadata/types";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import type {
    MetadataEpisodeOption,
    MetadataReviewItem,
    MetadataReviewReason,
    MetadataSearchOption,
    MetadataSelection,
    UploadSeriesGroupOption,
    UploadWorkflowSetup,
} from "@/lib/uploadWorkflowTypes";
import {
    CATALOG_TAG,
    VOD_ORIGIN,
    serviceHeaders,
    sessionHeaders,
} from "@/lib/vodConfig";

const MAX_SEARCH_LENGTH = 100;

const authenticatedHeaders = async (): Promise<DataResult<Record<string, string>>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/me.php`, {
            headers,
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);
        return dataSuccess(headers);
    } catch {
        return dataFailure("network");
    }
};

const readGroups = async (headers: Record<string, string>): Promise<DataResult<UploadSeriesGroupOption[]>> => {
    try {
        const response = await fetch(`${VOD_ORIGIN}/series-groups.php`, {
            headers,
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);

        const payload: unknown = await response.json();

        if (
            typeof payload !== "object"
            || payload === null
            || !Array.isArray((payload as { groups?: unknown }).groups)
        ) {
            return dataFailure("invalid_response");
        }

        const groups: UploadSeriesGroupOption[] = [];

        for (const item of (payload as { groups: unknown[] }).groups) {
            if (
                typeof item !== "object"
                || item === null
                || typeof (item as { id?: unknown }).id !== "number"
                || typeof (item as { baseTitle?: unknown }).baseTitle !== "string"
            ) {
                return dataFailure("invalid_response");
            }

            groups.push({
                id: (item as { id: number }).id,
                baseTitle: (item as { baseTitle: string }).baseTitle,
            });
        }

        return dataSuccess(groups);
    } catch {
        return dataFailure("network");
    }
};

const readMetadataReview = async (
    headers: Record<string, string>,
    titles: Map<string, string>,
): Promise<DataResult<MetadataReviewItem[]>> => {
    try {
        const response = await fetch(`${VOD_ORIGIN}/series-metadata.php?review=1`, {
            headers,
            cache: "no-store",
        });
        if (!response.ok) return failureFromStatus(response.status);

        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { items?: unknown }).items)) {
            return dataFailure("invalid_response");
        }

        const items: MetadataReviewItem[] = [];
        for (const value of (payload as { items: unknown[] }).items) {
            if (typeof value !== "object" || value === null) return dataFailure("invalid_response");
            const item = value as Record<string, unknown>;
            if (
                typeof item.seriesKey !== "string"
                || (item.groupId !== null && typeof item.groupId !== "number")
                || (item.seasonNumber !== null && typeof item.seasonNumber !== "number")
                || typeof item.externalIds !== "object" || item.externalIds === null
                || typeof item.externalIdSources !== "object" || item.externalIdSources === null
                || !Array.isArray(item.artwork)
            ) return dataFailure("invalid_response");

            const externalIds = item.externalIds as Record<string, string>;
            const savedReason = typeof item.reviewReason === "string" ? item.reviewReason as MetadataReviewReason : null;
            const skipped = item.reviewState === "skipped";
            const hasIdentity = Object.keys(externalIds).length > 0;
            const reason: MetadataReviewReason | null = skipped
                ? savedReason
                : !hasIdentity
                    ? savedReason === "partial-match" ? "partial-match" : "no-match"
                    : !externalIds.tmdb
                        ? "missing-tmdb"
                        : savedReason === "uncertain-season" || (item.groupId !== null && item.seasonNumber === null)
                            ? "uncertain-season"
                            : null;

            const artwork = item.artwork.flatMap((entry) => {
                if (typeof entry !== "object" || entry === null) return [];
                const image = entry as Record<string, unknown>;
                if (
                    typeof image.id !== "number"
                    || !["poster", "backdrop", "logo"].includes(String(image.kind))
                    || typeof image.url !== "string"
                    || typeof image.provider !== "string"
                    || typeof image.isPrimary !== "boolean"
                    || !["auto", "manual"].includes(String(image.matchSource))
                ) return [];
                return [{
                    id: image.id,
                    kind: image.kind as "poster" | "backdrop" | "logo",
                    url: image.url,
                    width: typeof image.width === "number" ? image.width : null,
                    height: typeof image.height === "number" ? image.height : null,
                    provider: image.provider,
                    language: typeof image.language === "string" ? image.language : null,
                    isPrimary: image.isPrimary,
                    matchSource: image.matchSource as "auto" | "manual",
                }];
            });

            items.push({
                seriesKey: item.seriesKey,
                title: titles.get(item.seriesKey) ?? item.seriesKey,
                groupId: item.groupId as number | null,
                seasonNumber: item.seasonNumber as number | null,
                state: skipped ? "skipped" : reason ? "pending" : "ready",
                reason,
                externalIds,
                externalIdSources: item.externalIdSources as Record<string, "auto" | "manual">,
                artwork,
            });
        }

        return dataSuccess(items);
    } catch {
        return dataFailure("network");
    }
};

const refreshCatalog = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${VOD_ORIGIN}/catalog.php?force=1`, {
            headers: serviceHeaders(),
            cache: "no-store",
        });

        if (!response.ok) return false;

        const payload: unknown = await response.json();
        const result = validateCatalogResponse(payload);

        if (!result.ok) return false;

        updateTag(CATALOG_TAG);
        return true;
    } catch {
        return false;
    }
};

export const getUploadWorkflowSetup = async (): Promise<UploadWorkflowSetup> => {
    const auth = await authenticatedHeaders();

    if (auth.kind === "error") {
        return {
            series: [],
            groups: [],
            metadataReview: [],
            unauthorized: auth.reason === "unauthorized" || auth.reason === "forbidden",
            unavailable: auth.reason !== "unauthorized" && auth.reason !== "forbidden",
        };
    }

    const catalog = await getCatalog();
    const titles = new Map(catalog.kind === "error" ? [] : catalog.data.map((entry) => [entry.key, entry.title]));
    const [groups, metadataReview] = await Promise.all([
        readGroups(auth.data),
        readMetadataReview(auth.data, titles),
    ]);

    return {
        series: catalog.kind === "error"
            ? []
            : catalog.data.map((entry) => ({
                key: entry.key,
                title: entry.title,
                metadataProvider: entry.metadataProvider,
                externalId: entry.externalId,
                groupId: entry.groupId,
                seasonNumber: entry.seasonNumber,
                episodes: entry.episodes.map((episode) => ({
                    key: episode.key,
                    number: episode.number,
                    durationSeconds: episode.durationSeconds,
                })),
            })),
        groups: groups.kind === "error" ? [] : groups.data,
        metadataReview: metadataReview.kind === "error" ? [] : metadataReview.data,
        unauthorized: false,
        unavailable: catalog.kind === "error" || groups.kind === "error" || metadataReview.kind === "error",
    };
};

export const searchMetadataAction = async (query: string): Promise<DataResult<MetadataSearchOption[]>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    const normalized = query.trim();
    if (normalized.length < 2 || normalized.length > MAX_SEARCH_LENGTH) {
        return dataEmpty([]);
    }

    const result = await searchIdentityCandidates(normalized);
    if (result.kind === "error") return result;

    const items: MetadataSearchOption[] = result.data.map((candidate) => ({
        providerId: candidate.providerId,
        externalId: candidate.externalId,
        title: candidate.title,
        altTitles: candidate.altTitles,
        year: candidate.year,
        type: candidate.format,
        coverImage: candidate.coverImage,
    }));

    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};

export const loadMetadataSelectionAction = async (
    providerId: ProviderId,
    externalId: string,
): Promise<DataResult<MetadataSelection>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    const normalizedExternalId = providerId === "tmdb" && /^\d+$/.test(externalId.trim())
        ? `tv:${externalId.trim()}`
        : externalId.trim();
    if (normalizedExternalId === "") return dataFailure("invalid_response");

    const provider = getProvider(providerId);
    if (!provider || !provider.getArtwork) return dataFailure("server");

    const [seriesResult, artworkResult] = await Promise.all([
        provider.getSeries(normalizedExternalId),
        provider.getArtwork(normalizedExternalId),
    ]);

    if (seriesResult.kind === "error") return seriesResult;
    if (artworkResult.kind === "error") return artworkResult;

    const episodesResult = provider.getEpisodes ? await provider.getEpisodes(normalizedExternalId) : null;
    if (episodesResult && episodesResult.kind === "error") return episodesResult;

    const series = seriesResult.data;
    const poster = artworkResult.data.find((entry) => entry.kind === "poster")?.url ?? null;
    const backdrop = artworkResult.data.find((entry) => entry.kind === "backdrop")?.url ?? null;
    const episodes: MetadataEpisodeOption[] = (episodesResult?.data ?? []).map((episode) => ({
        number: episode.number,
        title: episode.title,
    }));

    return dataSuccess({
        providerId,
        externalId: normalizedExternalId,
        malId: series.malId,
        title: series.titles.english?.trim() || series.titles.primary,
        coverImage: poster,
        backdropImage: backdrop,
        synopsis: series.synopsis,
        rating: series.score !== null ? String(series.score) : null,
        ageRating: series.ageRating,
        year: series.year,
        genres: series.genres,
        studio: series.studio,
        episodes,
    });
};

export const saveSeriesMetadataAction = async (
    seriesKey: string,
    providerId: ProviderId,
    externalId: string,
): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    const key = seriesKey.trim();
    if (key === "" || key.length > 255 || externalId.trim() === "") {
        return dataFailure("invalid_response");
    }

    const normalizedExternalId = providerId === "tmdb" && /^\d+$/.test(externalId.trim())
        ? `tv:${externalId.trim()}`
        : externalId.trim();
    const provider = getProvider(providerId);
    if (!provider || !provider.getArtwork) return dataFailure("server");

    const [seriesResult, artworkResult] = await Promise.all([
        provider.getSeries(normalizedExternalId),
        provider.getArtwork(normalizedExternalId),
    ]);

    if (seriesResult.kind === "error") return seriesResult;
    if (artworkResult.kind === "error") return artworkResult;

    const saved = await persistSeriesIdentity(key, providerId, normalizedExternalId, seriesResult.data, artworkResult.data, "manual");
    return saved ? dataSuccess({ success: true }) : dataFailure("server");
};

export const saveEpisodeTitleAction = async (
    seriesKey: string,
    episodeKey: string,
    title: string,
): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    const normalizedTitle = title.trim();
    if (seriesKey.trim() === "" || episodeKey.trim() === "" || normalizedTitle.length > 255) {
        return dataFailure("invalid_response");
    }

    try {
        const response = await fetch(`${VOD_ORIGIN}/episode-metadata.php`, {
            method: "POST",
            headers: { ...auth.data, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
                series: seriesKey,
                episode: episodeKey,
                title: normalizedTitle || null,
            }),
        });

        return response.ok ? dataSuccess({ success: true }) : failureFromStatus(response.status);
    } catch {
        return dataFailure("network");
    }
};

export const saveIntroChapterAction = async (
    seriesKey: string,
    episodeKey: string,
    startSeconds: number,
    endSeconds: number,
    applyToSeries: boolean,
): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    if (
        !Number.isSafeInteger(startSeconds)
        || !Number.isSafeInteger(endSeconds)
        || startSeconds < 0
        || startSeconds >= endSeconds
    ) {
        return dataFailure("invalid_response");
    }

    try {
        const response = await fetch(`${VOD_ORIGIN}/chapters.php`, {
            method: "POST",
            headers: { ...auth.data, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
                series: seriesKey,
                episode: episodeKey,
                type: "intro",
                startSeconds,
                endSeconds,
                applyToSeries,
            }),
        });

        return response.ok ? dataSuccess({ success: true }) : failureFromStatus(response.status);
    } catch {
        return dataFailure("network");
    }
};

export const saveSeriesGroupingAction = async (
    seriesKey: string,
    groupId: number | null,
    newBaseTitle: string | null,
    seasonNumber: number | null,
): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    if (seriesKey.trim() === "" || seriesKey.length > 255) return dataFailure("invalid_response");
    if (groupId !== null && (!Number.isSafeInteger(groupId) || groupId < 1)) return dataFailure("invalid_response");
    if (seasonNumber !== null && (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1 || seasonNumber > 999)) {
        return dataFailure("invalid_response");
    }

    let resolvedGroupId = groupId;
    const normalizedBaseTitle = newBaseTitle?.trim() || null;

    if (normalizedBaseTitle !== null) {
        if (normalizedBaseTitle.length > 255) return dataFailure("invalid_response");

        try {
            const createResponse = await fetch(`${VOD_ORIGIN}/series-groups.php`, {
                method: "POST",
                headers: { ...auth.data, "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({ baseTitle: normalizedBaseTitle }),
            });

            if (!createResponse.ok) return failureFromStatus(createResponse.status);

            const payload: unknown = await createResponse.json();
            if (
                typeof payload !== "object"
                || payload === null
                || typeof (payload as { id?: unknown }).id !== "number"
            ) {
                return dataFailure("invalid_response");
            }

            resolvedGroupId = (payload as { id: number }).id;
        } catch {
            return dataFailure("network");
        }
    }

    try {
        const response = await fetch(`${VOD_ORIGIN}/series-groups.php`, {
            method: "PATCH",
            headers: { ...auth.data, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ seriesKey, groupId: resolvedGroupId, seasonNumber }),
        });

        if (!response.ok) return failureFromStatus(response.status);
        return (await refreshCatalog()) ? dataSuccess({ success: true }) : dataFailure("server");
    } catch {
        return dataFailure("network");
    }
};

export const refreshUploadCatalogAction = async (): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;
    return (await refreshCatalog()) ? dataSuccess({ success: true }) : dataFailure("server");
};
