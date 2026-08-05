"use server";

import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateAdminMediaDeleteResponse,
    validateStorageUsageResponse,
    type AdminMediaDeleteResponse,
    type StorageUsageResponse,
} from "@/lib/contracts";
import { dataFailure, dataSuccess, failureFromStatus, type DataResult } from "@/lib/dataResult";

export const getStorageUsageAction = async (): Promise<DataResult<StorageUsageResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/storage-usage.php`, {
            headers,
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);

        const result = validateStorageUsageResponse(await response.json());

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("Storage usage request failed:", error);
        return dataFailure("network");
    }
};

export const deleteAdminMediaAction = async (
    seriesKey: string,
    episodeKey: string,
): Promise<DataResult<AdminMediaDeleteResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/admin-media-delete.php`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify({ seriesKey, episodeKey }),
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);

        const result = validateAdminMediaDeleteResponse(await response.json());

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("Admin media delete request failed:", error);
        return dataFailure("network");
    }
};
