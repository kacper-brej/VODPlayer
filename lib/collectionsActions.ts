"use server";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateAddCollectionItemResponse,
    validateCreateCollectionResponse,
    validateDeleteCollectionResponse,
    validateRemoveCollectionItemResponse,
    validateRenameCollectionResponse,
    type AddCollectionItemResponse,
    type CreateCollectionResponse,
    type DeleteCollectionResponse,
    type RemoveCollectionItemResponse,
    type RenameCollectionResponse,
} from "@/lib/contracts";
import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

const buildQuery = (params: Record<string, string | null>): string => {
    const entries = Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== null);
    if (entries.length === 0) return "";
    return `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
};

export const createCollectionAction = async (name: string): Promise<DataResult<CreateCollectionResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const query = buildQuery({ profile_id: profileId });
        const res = await fetch(`${VOD_ORIGIN}/collections.php${query}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            cache: "no-store",
            body: JSON.stringify({ name }),
        });

        if (!res.ok) {
            console.error("collections.php POST ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateCreateCollectionResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("createCollectionAction failed", error);
        return dataFailure("network");
    }
};

export const renameCollectionAction = async (
    collectionId: number,
    name: string,
): Promise<DataResult<RenameCollectionResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const query = buildQuery({ id: String(collectionId), profile_id: profileId });
        const res = await fetch(`${VOD_ORIGIN}/collections.php${query}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...headers },
            cache: "no-store",
            body: JSON.stringify({ name }),
        });

        if (!res.ok) {
            console.error("collections.php PATCH ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateRenameCollectionResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("renameCollectionAction failed", error);
        return dataFailure("network");
    }
};

export const deleteCollectionAction = async (
    collectionId: number,
): Promise<DataResult<DeleteCollectionResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const query = buildQuery({ id: String(collectionId), profile_id: profileId });
        const res = await fetch(`${VOD_ORIGIN}/collections.php${query}`, {
            method: "DELETE",
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("collections.php DELETE ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateDeleteCollectionResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("deleteCollectionAction failed", error);
        return dataFailure("network");
    }
};

export const addToCollectionAction = async (
    collectionId: number,
    seriesKey: string,
): Promise<DataResult<AddCollectionItemResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const query = buildQuery({ id: String(collectionId), profile_id: profileId });
        const res = await fetch(`${VOD_ORIGIN}/collections.php${query}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            cache: "no-store",
            body: JSON.stringify({ series: seriesKey }),
        });

        if (!res.ok) {
            console.error("collections.php POST item ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateAddCollectionItemResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("addToCollectionAction failed", error);
        return dataFailure("network");
    }
};

export const removeFromCollectionAction = async (
    collectionId: number,
    seriesKey: string,
): Promise<DataResult<RemoveCollectionItemResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const query = buildQuery({ id: String(collectionId), series: seriesKey, profile_id: profileId });
        const res = await fetch(`${VOD_ORIGIN}/collections.php${query}`, {
            method: "DELETE",
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("collections.php DELETE item ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateRemoveCollectionItemResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("removeFromCollectionAction failed", error);
        return dataFailure("network");
    }
};
