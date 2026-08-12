import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { getMediaStatus } from "@/lib/admin/mediaStatusService";
import type { MediaStatusResponse } from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export const getMediaStorageStatus = async (): Promise<DataResult<MediaStatusResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        const status = await getMediaStatus();
        return dataSuccess(status);
    } catch (error) {
        console.error("getMediaStorageStatus failed:", error);
        return dataFailure("server");
    }
};
