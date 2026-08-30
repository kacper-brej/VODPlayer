import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import {
    compareLibrary,
    type LibraryEntry,
    type LibraryEntryState,
} from "@/lib/media/libraryRegistration";
import { scanFileLibrary } from "@/lib/media/libraryScanClient";
import {
    listRegisteredAssetKeys,
    registerFileAsset,
    syncFilePreviewClip,
} from "@/lib/media/libraryRegistrationRepository";

export type LibraryScanFailure = "unconfigured" | "unreachable" | "rejected" | "malformed";

export type LibraryOverviewResult =
    | { ok: true; entries: LibraryEntry[]; counts: Record<LibraryEntryState, number> }
    | { ok: false; code: LibraryScanFailure };

export interface RegistrationRequest {
    seriesKey: string;
    episodeKey: string;
}

export interface RegistrationSummary {
    inserted: number;
    skipped: number;
    previewsLinked: number;
}

const emptyCounts = (): Record<LibraryEntryState, number> =>
    ({ new: 0, registered: 0, hls: 0, orphaned: 0 });

export const libraryOverview = async (): Promise<LibraryOverviewResult> => {
    const scan = await scanFileLibrary();
    if (!scan.ok) return { ok: false, code: scan.code };

    const entries = compareLibrary(scan.series, await listRegisteredAssetKeys());
    const counts = entries.reduce((total, entry) => {
        total[entry.state] += 1;
        return total;
    }, emptyCounts());

    return { ok: true, entries, counts };
};

// Rejestrujemy wylacznie to, co skan faktycznie widzi na dysku i co nie ma
// jeszcze assetu. Zadanie z panelu nie jest zrodlem prawdy - klient moze
// przyslac cokolwiek, wiec kazda pozycja jest sprawdzana wzgledem swiezego skanu.
export const registerFileEpisodes = async (
    requested: RegistrationRequest[],
): Promise<{ ok: true; summary: RegistrationSummary } | { ok: false; code: LibraryScanFailure }> => {
    const overview = await libraryOverview();
    if (!overview.ok) return { ok: false, code: overview.code };

    const onDisk = new Map(
        overview.entries.map((entry) => [`${entry.seriesKey} ${entry.episodeKey}`, entry]),
    );

    const summary: RegistrationSummary = { inserted: 0, skipped: 0, previewsLinked: 0 };

    for (const item of requested) {
        const entry = onDisk.get(`${item.seriesKey} ${item.episodeKey}`);
        if (entry === undefined || entry.state !== "new" || entry.sizeBytes === null) {
            summary.skipped += 1;
            continue;
        }
        const outcome = await registerFileAsset(
            item.seriesKey,
            item.episodeKey,
            entry.previewClipKey,
            entry.sizeBytes,
        );
        if (outcome === "inserted") summary.inserted += 1;
        else summary.skipped += 1;
    }

    // Klip podgladowy moze trafic na dysk pozniej niz odcinek, wiec kazdy skan
    // wyrownuje stan pozycji juz zarejestrowanych.
    for (const entry of overview.entries) {
        if (entry.state !== "registered") continue;
        if (await syncFilePreviewClip(entry.seriesKey, entry.episodeKey, entry.previewClipKey)) {
            summary.previewsLinked += 1;
        }
    }

    if (summary.inserted > 0 || summary.previewsLinked > 0) revalidateTag(CATALOG_TAG, "max");

    return { ok: true, summary };
};
