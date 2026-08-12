import "server-only";
import { cache } from "react";
import { findReadyHlsAssetByMediaKey } from "@/lib/player/hlsRepository";
import type { EnvSource } from "@/lib/config/env";

export interface DemoAsset {
    assetId: number;
    assetVersion: number;
    seriesKey: string;
    episodeKey: string;
    durationSeconds: number | null;
    heights: number[];
}

export interface DemoAssetKeys {
    seriesKey: string;
    episodeKey: string;
}

export const demoAssetKeys = (env: EnvSource = process.env): DemoAssetKeys | null => {
    const seriesKey = env.DEMO_ASSET_SERIES_KEY?.trim();
    const episodeKey = env.DEMO_ASSET_EPISODE_KEY?.trim();
    if (!seriesKey || !episodeKey) return null;
    return { seriesKey, episodeKey };
};

export const getDemoAsset = cache(async (): Promise<DemoAsset | null> => {
    const keys = demoAssetKeys();
    if (!keys) return null;

    try {
        const asset = await findReadyHlsAssetByMediaKey(keys.seriesKey, keys.episodeKey);
        if (!asset) {
            console.error(
                "materiał demonstracyjny: brak gotowego assetu dla skonfigurowanych kluczy",
                keys.seriesKey,
                keys.episodeKey,
            );
            return null;
        }

        return {
            assetId: asset.id,
            assetVersion: asset.version,
            seriesKey: keys.seriesKey,
            episodeKey: keys.episodeKey,
            durationSeconds: asset.durationSeconds,
            heights: asset.renditions.map((rendition) => rendition.height),
        };
    } catch (error) {
        console.error("materiał demonstracyjny: nie udało się odczytać assetu", error);
        return null;
    }
});
