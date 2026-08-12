type RouteIdentifier = string | number;

export const seriesPath = (id: RouteIdentifier) =>
    `/series/${encodeURIComponent(String(id))}`;

export const watchPath = (seriesId: RouteIdentifier, episode?: RouteIdentifier) => {
    const params = new URLSearchParams({ id: String(seriesId) });

    if (episode !== undefined) {
        const logicalKey = String(episode);
        const legacyNumericKey = /^(\d+)\.mp4$/i.exec(logicalKey);
        params.set("ep", legacyNumericKey ? String(Number.parseInt(legacyNumericKey[1]!, 10)) : logicalKey);
    }

    return `/watch?${params.toString()}`;
};

export const partyWatchPath = (seriesId: RouteIdentifier, episode: RouteIdentifier, code: string) =>
    `${watchPath(seriesId, episode)}&party=${encodeURIComponent(code)}`;

export const safeReturnPath = (value: string | null, fallback = "/profiles") => {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
    if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
    try {
        const parsed = new URL(value, "https://nocturna.invalid");
        return parsed.origin === "https://nocturna.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
    } catch {
        return fallback;
    }
};
