import "server-only";
import type {
    ManagedSeriesVisibility,
    SeriesAccessOverviewResponse,
} from "@/lib/core/contracts";
import {
    deleteDemoProgressForUser,
    grantSeriesAccess,
    listAllGrants,
    loadVisibilityMap,
    revokeSeriesAccess,
    setSeriesVisibility,
} from "@/lib/access/seriesAccessRepository";
import { getDemoAsset } from "@/lib/access/demoAsset";
import { normalizeVisibility } from "@/lib/access/seriesAccessService";
import { listAdminLibrary } from "@/lib/admin/adminLibraryRepository";
import { getAdminUsers } from "@/lib/admin/adminUserService";

export const getSeriesAccessOverview = async (): Promise<SeriesAccessOverviewResponse> => {
    const [users, library, visibility, grants] = await Promise.all([
        getAdminUsers(),
        listAdminLibrary(),
        loadVisibilityMap(),
        listAllGrants(),
    ]);

    const series = library.series
        .map((entry) => ({
            seriesKey: entry.seriesKey,
            visibility: normalizeVisibility(visibility.get(entry.seriesKey) ?? null),
        }))
        .filter((entry) => entry.visibility !== "system");

    const managedKeys = new Set(series.map((entry) => entry.seriesKey));

    return {
        users,
        series,
        grants: grants.filter((grant) => managedKeys.has(grant.seriesKey)),
    };
};

export const changeSeriesVisibility = async (
    seriesKey: string,
    visibility: ManagedSeriesVisibility,
): Promise<void> => {
    await setSeriesVisibility(seriesKey, visibility);
};

export const grantAccessAndDropDemoProgress = async (
    seriesKey: string,
    userId: number,
    grantedBy: number,
): Promise<{ removedProgressRows: number }> => {
    await grantSeriesAccess(seriesKey, userId, grantedBy);

    const demo = await getDemoAsset();
    if (!demo) return { removedProgressRows: 0 };

    const removedProgressRows = await deleteDemoProgressForUser(userId, seriesKey, demo.assetId);
    return { removedProgressRows };
};

export const revokeAccess = async (seriesKey: string, userId: number): Promise<void> => {
    await revokeSeriesAccess(seriesKey, userId);
};
