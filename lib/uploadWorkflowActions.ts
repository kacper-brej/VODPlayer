"use server";

import { updateTag } from "next/cache";
import { getCatalog } from "@/lib/catalog";
import {
    validateCatalogResponse,
    validateJikanAnimeListResponse,
    validateJikanAnimeResponse,
    validateJikanEpisodesResponse,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";
import { fetchJikanResult } from "@/lib/jikanClient";
import { mapJikanSeriesMetadata, persistSeriesMetadata } from "@/lib/seriesMetadata";
import type {
    JikanEpisodeOption,
    JikanSearchOption,
    JikanSelection,
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
const MAX_EPISODE_PAGES = 500;

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

const readAnime = async (malId: number) => {
    const path = `/anime/${malId}`;
    const response = await fetchJikanResult(
        path,
        undefined,
        (value) => validateJikanAnimeResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateJikanAnimeResponse(response.data);
    return result.ok ? dataSuccess(result.data.data) : dataFailure("invalid_response");
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
            unauthorized: auth.reason === "unauthorized" || auth.reason === "forbidden",
            unavailable: auth.reason !== "unauthorized" && auth.reason !== "forbidden",
        };
    }

    const [catalog, groups] = await Promise.all([getCatalog(), readGroups(auth.data)]);

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
        unauthorized: false,
        unavailable: catalog.kind === "error" || groups.kind === "error",
    };
};

export const searchJikanAction = async (query: string): Promise<DataResult<JikanSearchOption[]>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    const normalized = query.trim();
    if (normalized.length < 2 || normalized.length > MAX_SEARCH_LENGTH) {
        return dataEmpty([]);
    }

    const path = `/anime?q=${encodeURIComponent(normalized)}&limit=8&sfw=true`;
    const response = await fetchJikanResult(
        path,
        undefined,
        (value) => validateJikanAnimeListResponse(value).ok,
    );

    if (response.kind === "error") return response;

    const result = validateJikanAnimeListResponse(response.data);
    if (!result.ok) return dataFailure("invalid_response");

    const items = result.data.data
        .filter((anime) => !anime.rating?.startsWith("Rx"))
        .map((anime) => ({
            malId: anime.mal_id,
            title: anime.title_english?.trim() || anime.title,
            year: anime.year,
            type: anime.type,
            coverImage: anime.images.webp.large_image_url || anime.images.jpg.image_url || null,
        }));

    return items.length === 0 ? dataEmpty(items) : dataSuccess(items);
};

export const loadJikanSelectionAction = async (malId: number): Promise<DataResult<JikanSelection>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    if (!Number.isSafeInteger(malId) || malId < 1) return dataFailure("invalid_response");

    const animeResult = await readAnime(malId);
    if (animeResult.kind === "error") return animeResult;

    const episodes: JikanEpisodeOption[] = [];
    const seenNumbers = new Set<number>();
    let page = 1;
    let hasNext = true;

    while (hasNext && page <= MAX_EPISODE_PAGES) {
        const path = `/anime/${malId}/episodes?page=${page}`;
        const response = await fetchJikanResult(
            path,
            undefined,
            (value) => validateJikanEpisodesResponse(value).ok,
        );

        if (response.kind === "error") return response;

        const result = validateJikanEpisodesResponse(response.data);
        if (!result.ok) return dataFailure("invalid_response");

        for (const episode of result.data.data) {
            if (!seenNumbers.has(episode.mal_id)) {
                seenNumbers.add(episode.mal_id);
                episodes.push({ number: episode.mal_id, title: episode.title?.trim() || null });
            }
        }

        hasNext = result.data.pagination.has_next_page;
        page += 1;
    }

    if (hasNext) return dataFailure("server");

    const anime = animeResult.data;
    const metadata = mapJikanSeriesMetadata(anime);

    return dataSuccess({
        malId: anime.mal_id,
        title: anime.title_english?.trim() || anime.title,
        coverImage: metadata.coverImage,
        backdropImage: metadata.backdropImage,
        synopsis: metadata.synopsis,
        rating: metadata.rating,
        ageRating: metadata.ageRating,
        year: metadata.year,
        genres: metadata.genres,
        studio: metadata.studio,
        episodes,
    });
};

export const saveSeriesMetadataAction = async (
    seriesKey: string,
    malId: number,
): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;

    const key = seriesKey.trim();
    if (key === "" || key.length > 255 || !Number.isSafeInteger(malId) || malId < 1) {
        return dataFailure("invalid_response");
    }

    const anime = await readAnime(malId);
    if (anime.kind === "error") return anime;

    const saved = await persistSeriesMetadata(key, mapJikanSeriesMetadata(anime.data));
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

    if ((resolvedGroupId === null) !== (seasonNumber === null)) return dataFailure("invalid_response");
    if (!(await refreshCatalog())) return dataFailure("server");

    try {
        const response = await fetch(`${VOD_ORIGIN}/series-groups.php`, {
            method: "PATCH",
            headers: { ...auth.data, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ seriesKey, groupId: resolvedGroupId, seasonNumber }),
        });

        return response.ok ? dataSuccess({ success: true }) : failureFromStatus(response.status);
    } catch {
        return dataFailure("network");
    }
};

export const refreshUploadCatalogAction = async (): Promise<DataResult<{ success: true }>> => {
    const auth = await authenticatedHeaders();
    if (auth.kind === "error") return auth;
    return (await refreshCatalog()) ? dataSuccess({ success: true }) : dataFailure("server");
};
