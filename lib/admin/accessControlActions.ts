"use server";

import { updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import {
    isManagedSeriesVisibility,
    type SeriesAccessOverviewResponse,
} from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import {
    changeSeriesVisibility,
    getSeriesAccessOverview,
    grantAccessAndDropDemoProgress,
    revokeAccess,
} from "@/lib/admin/accessControlService";

const MAX_SERIES_KEY_LENGTH = 255;

const requireAdminUser = async () => {
    const user = await getSessionUser();
    if (!user) return { ok: false as const, result: dataFailure("unauthorized", 401) };
    if (user.role !== "admin") return { ok: false as const, result: dataFailure("forbidden", 403) };
    return { ok: true as const, user };
};

const validSeriesKey = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0 && value.length <= MAX_SERIES_KEY_LENGTH;

const validUserId = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export const getSeriesAccessOverviewAction = async (): Promise<DataResult<SeriesAccessOverviewResponse>> => {
    const guard = await requireAdminUser();
    if (!guard.ok) return guard.result;

    try {
        return dataSuccess(await getSeriesAccessOverview());
    } catch (error) {
        console.error("getSeriesAccessOverviewAction failed:", error);
        return dataFailure("server");
    }
};

export const setSeriesVisibilityAction = async (
    seriesKey: unknown,
    visibility: unknown,
): Promise<DataResult<{ success: true }>> => {
    const guard = await requireAdminUser();
    if (!guard.ok) return guard.result;

    if (!validSeriesKey(seriesKey) || !isManagedSeriesVisibility(visibility)) {
        return dataFailure("invalid_response", 400);
    }

    try {
        await changeSeriesVisibility(seriesKey, visibility);
        updateTag(CATALOG_TAG);
        return dataSuccess({ success: true });
    } catch (error) {
        console.error("setSeriesVisibilityAction failed:", error);
        return dataFailure("server");
    }
};

export const grantSeriesAccessAction = async (
    seriesKey: unknown,
    userId: unknown,
): Promise<DataResult<{ removedProgressRows: number }>> => {
    const guard = await requireAdminUser();
    if (!guard.ok) return guard.result;

    if (!validSeriesKey(seriesKey) || !validUserId(userId)) {
        return dataFailure("invalid_response", 400);
    }

    try {
        return dataSuccess(await grantAccessAndDropDemoProgress(seriesKey, userId, guard.user.id));
    } catch (error) {
        console.error("grantSeriesAccessAction failed:", error);
        return dataFailure("server");
    }
};

export const revokeSeriesAccessAction = async (
    seriesKey: unknown,
    userId: unknown,
): Promise<DataResult<{ success: true }>> => {
    const guard = await requireAdminUser();
    if (!guard.ok) return guard.result;

    if (!validSeriesKey(seriesKey) || !validUserId(userId)) {
        return dataFailure("invalid_response", 400);
    }

    try {
        await revokeAccess(seriesKey, userId);
        return dataSuccess({ success: true });
    } catch (error) {
        console.error("revokeSeriesAccessAction failed:", error);
        return dataFailure("server");
    }
};
