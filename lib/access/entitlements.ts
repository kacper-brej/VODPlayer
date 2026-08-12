import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import type { AuthUser, SeriesAccessLevel, SeriesVisibility, UserRole } from "@/lib/core/contracts";
import { findSeriesVisibility, loadUserGrants } from "@/lib/access/seriesAccessRepository";
import { canStream, resolveSeriesAccess, type SeriesAccessInput } from "@/lib/access/seriesAccessService";

export interface ViewerEntitlements {
    role: UserRole | undefined;
    accessFor: (seriesKey: string, visibility: SeriesVisibility | null | undefined) => SeriesAccessLevel;
}

const getViewerGrantSet = cache(async (): Promise<ReadonlySet<string>> => {
    const user = await getSessionUser();
    if (!user || user.role === "admin") return new Set<string>();
    return new Set(await loadUserGrants(user.id));
});

const loadDecisionInput = async (user: AuthUser, seriesKey: string): Promise<SeriesAccessInput> => {
    const [visibility, granted] = await Promise.all([
        findSeriesVisibility(seriesKey),
        getViewerGrantSet(),
    ]);
    return { role: user.role, visibility, hasGrant: granted.has(seriesKey) };
};

export const getViewerEntitlements = cache(async (): Promise<ViewerEntitlements> => {
    const user = await getSessionUser();
    if (!user) {
        return { role: undefined, accessFor: () => "demo" };
    }

    const granted = await getViewerGrantSet();

    return {
        role: user.role,
        accessFor: (seriesKey, visibility) => resolveSeriesAccess({
            role: user.role,
            visibility,
            hasGrant: granted.has(seriesKey),
        }),
    };
});

export const getViewerSeriesAccessLevel = async (seriesKey: string): Promise<SeriesAccessLevel> => {
    const user = await getSessionUser();
    if (!user) return "demo";
    return getUserSeriesAccessLevel(user, seriesKey);
};

export const getUserSeriesAccessLevel = async (
    user: AuthUser,
    seriesKey: string,
): Promise<SeriesAccessLevel> => {
    if (user.role === "admin") return "full";
    return resolveSeriesAccess(await loadDecisionInput(user, seriesKey));
};

export const canStreamSeries = async (user: AuthUser, seriesKey: string): Promise<boolean> => {
    if (user.role === "admin") return true;

    return canStream(await loadDecisionInput(user, seriesKey));
};
