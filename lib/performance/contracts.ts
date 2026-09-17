export const METRIC_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB", "PLAYER_STARTUP", "PLAYER_SEEK", "PLAYER_BUFFER", "PLAYER_ERROR"] as const;
export const PAGE_GROUPS = ["home", "catalog", "series", "watch", "library", "settings", "other"] as const;
export const DEVICES = ["mobile", "desktop"] as const;
export const DELIVERY_TYPES = ["page", "file", "hls"] as const;
export const MAX_BATCH_SIZE = 20;

export type MetricName = typeof METRIC_NAMES[number];
export type PageGroup = typeof PAGE_GROUPS[number];
export interface PerformanceSample {
    id: string;
    name: MetricName;
    value: number;
    page: PageGroup;
    device: typeof DEVICES[number];
    delivery: typeof DELIVERY_TYPES[number];
}

export const pageGroup = (pathname: string): PageGroup => {
    if (pathname === "/") return "home";
    if (pathname === "/watch") return "watch";
    if (pathname.startsWith("/series/")) return "series";
    if (["/explore", "/genres", "/recent"].includes(pathname)) return "catalog";
    if (["/collections", "/continue", "/favourites", "/notifications"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "library";
    if (["/settings", "/profiles"].includes(pathname)) return "settings";
    return "other";
};

export const parsePerformanceBatch = (input: unknown): PerformanceSample[] | null => {
    if (!Array.isArray(input) || input.length < 1 || input.length > MAX_BATCH_SIZE) return null;
    const samples: PerformanceSample[] = [];
    for (const item of input) {
        if (!item || typeof item !== "object") return null;
        const { id, name, value, page, device, delivery } = item;
        if (typeof id !== "string" || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(id)
            || !METRIC_NAMES.includes(name) || !PAGE_GROUPS.includes(page)
            || !DEVICES.includes(device) || !DELIVERY_TYPES.includes(delivery)
            || typeof value !== "number" || !Number.isFinite(value) || value < 0
            || value > (name === "CLS" ? 100 : name === "PLAYER_ERROR" ? 1 : 600_000)
            || (name.startsWith("PLAYER_") ? page !== "watch" || delivery === "page" : delivery !== "page")
            || (name === "PLAYER_ERROR" && value !== 1)) return null;
        samples.push({ id, name, value, page, device, delivery });
    }
    return samples;
};
