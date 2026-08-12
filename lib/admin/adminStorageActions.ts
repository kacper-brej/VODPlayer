"use server";

import { revalidateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getStorageUsage } from "@/lib/admin/storageUsageService";
import { deleteMedia } from "@/lib/admin/mediaDeleteService";
import { DeleteB2ConfigError } from "@/lib/admin/b2AdminStorage";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import {
    type AdminMediaDeleteResponse,
    type StorageUsageResponse,
} from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export const getStorageUsageAction = async (): Promise<DataResult<StorageUsageResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        const usage = await getStorageUsage();
        return dataSuccess(usage);
    } catch (error) {
        console.error("getStorageUsageAction failed:", error);
        return dataFailure("server");
    }
};

export const deleteAdminMediaAction = async (
    seriesKey: string,
    episodeKey: string,
): Promise<DataResult<AdminMediaDeleteResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        const result = await deleteMedia(seriesKey, episodeKey);
        if (!result.ok) return dataFailure("invalid_response", 422);
        revalidateTag(CATALOG_TAG, "max");
        return dataSuccess({
            success: true,
            deletedB2Objects: result.deletedB2Objects,
        });
    } catch (error) {
        if (error instanceof DeleteB2ConfigError) return dataFailure("server", 503);
        console.error("deleteAdminMediaAction failed:", error);
        return dataFailure("server");
    }
};
