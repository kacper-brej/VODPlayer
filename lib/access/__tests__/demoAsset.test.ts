import { describe, expect, it } from "vitest";
import { demoAssetKeys } from "@/lib/access/demoAsset";

describe("konfiguracja materiału demonstracyjnego", () => {
    it("domyślnie wskazuje gotowy materiał Sprite Fright", () => {
        expect(demoAssetKeys({})).toEqual({ seriesKey: "Sprite Fright", episodeKey: "01.mp4" });
    });

    it("wymaga obu kluczy przy nadpisywaniu konfiguracji", () => {
        expect(demoAssetKeys({ DEMO_ASSET_SERIES_KEY: "_demo" })).toBeNull();
        expect(demoAssetKeys({ DEMO_ASSET_EPISODE_KEY: "demo.mp4" })).toBeNull();
    });

    it("pomija wartości puste i białe znaki", () => {
        expect(demoAssetKeys({ DEMO_ASSET_SERIES_KEY: "   ", DEMO_ASSET_EPISODE_KEY: "demo.mp4" })).toBeNull();
        expect(demoAssetKeys({ DEMO_ASSET_SERIES_KEY: " _demo ", DEMO_ASSET_EPISODE_KEY: " demo.mp4 " }))
            .toEqual({ seriesKey: "_demo", episodeKey: "demo.mp4" });
    });
});
