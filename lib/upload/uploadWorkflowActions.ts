"use server";

import { getAdminLibrary } from "@/lib/admin/adminLibraryService";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";
import { getSessionUser } from "@/lib/auth/session";
import { getProvider, searchIdentityCandidates } from "@/lib/metadata/registry";
import type { ProviderId } from "@/lib/metadata/types";
import { persistSeriesIdentity } from "@/lib/metadata/persistIdentity";
import type {
    MetadataReviewItem,
    MetadataSearchOption,
    UploadWorkflowSetup,
} from "@/lib/upload/uploadWorkflowTypes";
import { listMetadataReview } from "@/lib/seriesMetadata/metadataReviewService";

const MAX_SEARCH_LENGTH = 100;

const requireAdmin = async (): Promise<DataResult<{ id: number }>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);
    return dataSuccess({ id: user.id });
};

const readMetadataReview = async (
    titles: Map<string, string>,
): Promise<DataResult<MetadataReviewItem[]>> => {
    try {
        return dataSuccess(await listMetadataReview(titles));
    } catch (error) {
        console.error("readMetadataReview failed", error);
        return dataFailure("server");
    }
};

export const getUploadWorkflowSetup = async (): Promise<UploadWorkflowSetup> => {
    const auth = await requireAdmin();

    if (auth.kind === "error") {
        return {
            series: [],
            groups: [],
            metadataReview: [],
            unauthorized: auth.reason === "unauthorized" || auth.reason === "forbidden",
            unavailable: auth.reason !== "unauthorized" && auth.reason !== "forbidden",
        };
    }

    const [metadataReview, library] = await Promise.all([
        readMetadataReview(new Map()),
        getAdminLibrary()
            .then((value) => dataSuccess(value))
            .catch((error) => {
                console.error("getUploadWorkflowSetup: admin library failed", error);
                return dataFailure("server" as const);
            }),
    ]);
    const readySeriesKeys = new Set(library.kind === "error" ? [] : library.data.series.map((entry) => entry.seriesKey));

    return {
        series: [],
        groups: [],
        metadataReview: metadataReview.kind === "error"
            ? []
            : metadataReview.data.filter((item) => readySeriesKeys.has(item.seriesKey)),
        unauthorized: false,
        unavailable: metadataReview.kind === "error" || library.kind === "error",
    };
};

export const searchMetadataAction = async (query: string): Promise<DataResult<MetadataSearchOption[]>> => {
    const auth = await requireAdmin();
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

export const saveSeriesMetadataAction = async (
    seriesKey: string,
    providerId: ProviderId,
    externalId: string,
): Promise<DataResult<{ success: true }>> => {
    const auth = await requireAdmin();
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
