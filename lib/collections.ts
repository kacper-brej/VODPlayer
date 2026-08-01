import { cache } from "react";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateCollectionDetailResponse,
    validateCollectionsResponse,
    type CollectionDetail,
    type CollectionSummary,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export type { CollectionDetail, CollectionSummary };

const loadCollections = async (): Promise<DataResult<CollectionSummary[]>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/collections.php${profileParam}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("collections.php GET ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateCollectionsResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.collections.length === 0
            ? dataEmpty(result.data.collections)
            : dataSuccess(result.data.collections);
    } catch (error) {
        console.error("Collections request failed:", error);
        return dataFailure("network");
    }
};

export const getCollections = cache(loadCollections);

export const getCollection = cache(async (id: number): Promise<DataResult<CollectionDetail>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `&profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/collections.php?id=${encodeURIComponent(id)}${profileParam}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("collections.php GET id ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateCollectionDetailResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.items.length === 0
            ? dataEmpty(result.data)
            : dataSuccess(result.data);
    } catch (error) {
        console.error("Collection detail request failed:", error);
        return dataFailure("network");
    }
});
