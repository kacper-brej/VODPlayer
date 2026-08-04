"use server";

import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import {
    validateAdminLibraryResponse,
    validateAdminUsersResponse,
    type AdminLibraryResponse,
    type AdminUsersResponse,
} from "@/lib/contracts";
import { dataFailure, dataSuccess, failureFromStatus, type DataResult } from "@/lib/dataResult";

export const getAdminLibraryAction = async (): Promise<DataResult<AdminLibraryResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/admin-library.php`, {
            headers,
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);

        const result = validateAdminLibraryResponse(await response.json());

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("Admin library request failed:", error);
        return dataFailure("network");
    }
};

export const getAdminUsersAction = async (): Promise<DataResult<AdminUsersResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const response = await fetch(`${VOD_ORIGIN}/admin-users.php`, {
            headers,
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);

        const result = validateAdminUsersResponse(await response.json());

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("Admin users request failed:", error);
        return dataFailure("network");
    }
};
