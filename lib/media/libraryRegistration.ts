import type { ScannedSeries } from "@/lib/media/libraryScanClient";

// Stan pojedynczego odcinka w zestawieniu "co lezy na dysku" kontra "co zna baza".
// 'hls' jest osobno od 'registered', bo media_assets ma UNIQUE(series_key, episode_key):
// odcinek z gotowym assetem HLS nie moze zostac zarejestrowany jako plik bez
// nadpisania istniejacego wiersza, wiec panel nie moze go proponowac.
export type LibraryEntryState = "new" | "registered" | "hls" | "orphaned";

export interface LibraryEntry {
    seriesKey: string;
    episodeKey: string;
    sizeBytes: number | null;
    previewClipKey: string | null;
    state: LibraryEntryState;
}

export interface RegisteredAssetKey {
    seriesKey: string;
    episodeKey: string;
    delivery: "hls" | "file";
}

const entryKey = (seriesKey: string, episodeKey: string): string => `${seriesKey}\u0000${episodeKey}`;

export const compareLibrary = (
    scanned: ScannedSeries[],
    registered: RegisteredAssetKey[],
): LibraryEntry[] => {
    const known = new Map(registered.map((asset) => [entryKey(asset.seriesKey, asset.episodeKey), asset]));
    const seenOnDisk = new Set<string>();
    const entries: LibraryEntry[] = [];

    for (const series of scanned) {
        for (const episode of series.episodes) {
            const key = entryKey(series.seriesKey, episode.episodeKey);
            seenOnDisk.add(key);
            const asset = known.get(key);
            entries.push({
                seriesKey: series.seriesKey,
                episodeKey: episode.episodeKey,
                sizeBytes: episode.sizeBytes,
                previewClipKey: episode.previewClipKey,
                state: asset === undefined ? "new" : asset.delivery === "file" ? "registered" : "hls",
            });
        }
    }

    for (const asset of registered) {
        if (asset.delivery !== "file") continue;
        const key = entryKey(asset.seriesKey, asset.episodeKey);
        if (seenOnDisk.has(key)) continue;
        entries.push({
            seriesKey: asset.seriesKey,
            episodeKey: asset.episodeKey,
            sizeBytes: null,
            previewClipKey: null,
            state: "orphaned",
        });
    }

    return entries.sort((left, right) =>
        left.seriesKey.localeCompare(right.seriesKey, "pl")
        || left.episodeKey.localeCompare(right.episodeKey, "pl", { numeric: true }));
};

export const libraryStoragePrefix = (seriesKey: string): string => `uploads/${seriesKey}`;

export const registrableEntries = (entries: LibraryEntry[]): LibraryEntry[] =>
    entries.filter((entry) => entry.state === "new");
