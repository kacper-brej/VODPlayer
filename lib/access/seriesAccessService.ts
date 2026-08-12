import type { SeriesAccessLevel, SeriesVisibility, UserRole } from "@/lib/core/contracts";

export const DEFAULT_SERIES_VISIBILITY: SeriesVisibility = "restricted";

export interface SeriesAccessInput {
    role: UserRole | undefined;
    visibility: SeriesVisibility | null | undefined;
    hasGrant: boolean;
}

export const normalizeVisibility = (visibility: SeriesVisibility | null | undefined): SeriesVisibility =>
    visibility ?? DEFAULT_SERIES_VISIBILITY;

export const resolveSeriesAccess = ({ role, visibility, hasGrant }: SeriesAccessInput): SeriesAccessLevel => {
    if (role === "admin") return "full";

    switch (normalizeVisibility(visibility)) {
        case "public":
            return "full";
        case "restricted":
            return hasGrant ? "full" : "demo";
        default:
            return "demo";
    }
};

export const isCatalogVisible = (visibility: SeriesVisibility | null | undefined): boolean =>
    normalizeVisibility(visibility) !== "system";

export const canStream = (input: SeriesAccessInput): boolean =>
    normalizeVisibility(input.visibility) === "system" || resolveSeriesAccess(input) === "full";

export const resolveEntitlements = (
    role: UserRole | undefined,
    visibilityByKey: ReadonlyMap<string, SeriesVisibility>,
    grants: Iterable<string>,
    seriesKeys: Iterable<string>,
): ReadonlySet<string> => {
    const grantedKeys = new Set(grants);
    const entitled = new Set<string>();

    for (const seriesKey of seriesKeys) {
        const access = resolveSeriesAccess({
            role,
            visibility: visibilityByKey.get(seriesKey) ?? null,
            hasGrant: grantedKeys.has(seriesKey),
        });
        if (access === "full") entitled.add(seriesKey);
    }

    return entitled;
};
