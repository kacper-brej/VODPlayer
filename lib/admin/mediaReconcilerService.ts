import "server-only";
import { listB2MediaObjectKeys } from "@/lib/admin/b2AdminStorage";
import { listAssetsForReconciliation } from "@/lib/admin/mediaReconcilerRepository";

export interface MediaReconciliationReport {
    mode: "dry-run";
    scannedObjects: number;
    truncated: boolean;
    retryableDeletes: Array<{ assetId: number; seriesKey: string; episodeKey: string; status: string }>;
    missingPlaylists: Array<{ assetId: number; playlistKey: string }>;
    orphanPrefixes: string[];
    deletedPrefixesWithObjects: string[];
}

const objectPrefix = (key: string): string | null => {
    const parts = key.split("/");
    return parts.length >= 4 && parts[0] === "media"
        ? parts.slice(0, 3).join("/")
        : null;
};

export const reconcileMediaDryRun = async (): Promise<MediaReconciliationReport> => {
    const [assets, listed] = await Promise.all([
        listAssetsForReconciliation(),
        listB2MediaObjectKeys(),
    ]);
    const objectKeys = new Set(listed.keys);
    const objectPrefixes = new Set(listed.keys.map(objectPrefix).filter((value): value is string => value !== null));
    const knownPrefixes = new Set(assets.map((asset) => asset.storagePrefix));
    const deletedPrefixes = new Set(assets.filter((asset) => asset.status === "deleted").map((asset) => asset.storagePrefix));

    return {
        mode: "dry-run",
        scannedObjects: listed.keys.length,
        truncated: listed.truncated,
        retryableDeletes: assets
            .filter((asset) => asset.status === "deleting" || asset.status === "delete_failed")
            .map((asset) => ({
                assetId: asset.id,
                seriesKey: asset.seriesKey,
                episodeKey: asset.episodeKey,
                status: asset.status,
            })),
        missingPlaylists: assets
            .filter((asset) => asset.status === "ready")
            .flatMap((asset) => asset.playlistKeys
                .filter((playlistKey) => !objectKeys.has(playlistKey))
                .map((playlistKey) => ({ assetId: asset.id, playlistKey }))),
        orphanPrefixes: [...objectPrefixes].filter((prefix) => !knownPrefixes.has(prefix)).sort(),
        deletedPrefixesWithObjects: [...objectPrefixes].filter((prefix) => deletedPrefixes.has(prefix)).sort(),
    };
};
