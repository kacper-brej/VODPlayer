import type { SeriesDetails } from "@/lib/catalog/getSeriesDetailsAction";

const MAX_ENTRIES = 20;
const MAX_AGE_MS = 60_000;

export const mergeSeriesDetailsMetadata = (current: SeriesDetails, metadata: SeriesDetails): SeriesDetails => {
    if (current.id !== metadata.id || current.seriesKey !== metadata.seriesKey) return current;
    return {
        ...current,
        synopsis: metadata.synopsis,
        bannerImage: metadata.bannerImage,
        year: metadata.year,
        rating: metadata.rating,
        metadataPending: metadata.metadataPending,
        hasSynopsis: metadata.hasSynopsis,
    };
};

export const reuseSeriesDetailsMetadata = (fresh: SeriesDetails, cached: SeriesDetails | null): SeriesDetails => {
    if (!cached || !fresh.metadataPending || cached.metadataPending || fresh.id !== cached.id || fresh.seriesKey !== cached.seriesKey) return fresh;
    return {
        ...fresh,
        synopsis: fresh.hasSynopsis ? fresh.synopsis : cached.synopsis,
        bannerImage: fresh.bannerImage ?? cached.bannerImage,
        year: fresh.year ?? cached.year,
        rating: fresh.rating && fresh.rating !== "Local" ? fresh.rating : cached.rating,
        hasSynopsis: fresh.hasSynopsis || cached.hasSynopsis,
        metadataPending: false,
    };
};

export const createSeriesDetailsCache = () => {
    const entries = new Map<number, { details: SeriesDetails; expiresAt: number }>();

    return {
        get(id: number): SeriesDetails | null {
            const entry = entries.get(id);
            if (!entry) return null;
            if (Date.now() >= entry.expiresAt) {
                entries.delete(id);
                return null;
            }
            entries.delete(id);
            entries.set(id, entry);
            return { ...entry.details, episodes: entry.details.episodes.map((episode) => ({ ...episode })) };
        },
        set(details: SeriesDetails, id = details.id): void {
            const cached = {
                ...details,
                resumeEpisodeKey: null,
                episodes: details.episodes.map((episode) => ({
                    ...episode,
                    url: null,
                    positionSeconds: 0,
                    percent: 0,
                    watched: false,
                })),
            };
            entries.delete(id);
            entries.set(id, { details: cached, expiresAt: Date.now() + MAX_AGE_MS });
            if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
        },
        delete(id: number): void {
            entries.delete(id);
        },
        clear(): void {
            entries.clear();
        },
    };
};
