type RouteIdentifier = string | number;

export const seriesPath = (id: RouteIdentifier) =>
    `/series/${encodeURIComponent(String(id))}`;

export const watchPath = (seriesId: RouteIdentifier, episode?: RouteIdentifier) => {
    const params = new URLSearchParams({ id: String(seriesId) });

    if (episode !== undefined) {
        params.set("ep", String(episode));
    }

    return `/watch?${params.toString()}`;
};
