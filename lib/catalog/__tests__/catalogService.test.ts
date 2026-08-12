import { describe, expect, it, vi } from "vitest";

const loadCatalogRows = vi.fn();
vi.mock("@/lib/catalog/catalogRepository", () => ({ loadCatalogRows }));

const { buildCatalog } = await import("../catalogService");

describe("buildCatalog", () => {
    it("buduje odcinek HLS z rozmiarem i czasem media_asset oraz renditionami", async () => {
        loadCatalogRows.mockResolvedValue({
            assets: [{
                asset_id: 5, asset_version: 1, series_key: "Test", episode_key: "01.mp4",
                asset_duration_seconds: 1200, total_size_bytes: 900, preview_start_seconds: 30,
                preview_clip_key: "media/Test/01.mp4/preview.mp4", added_at: 100, updated_at: 200,
                series_id: 1000001, group_id: null, season_number: null, base_title: null,
                cover_row_title: null, cover_image: null, backdrop_image: null, backdrop_source: null,
                synopsis: null, rating: null, age_rating: null, year: null, focal_x: null, focal_y: null,
                safe_left: null, safe_bottom: null, dominant_color: null, placeholder: null, studio: null,
                audio_languages: null, subtitle_languages: null, metadata_provider: null, external_id: null,
                episode_title: null, episode_synopsis: null, episode_duration_seconds: null,
                thumbnail_path: "legacy/still.jpg", thumbnail_source: "local",
            }],
            renditions: [{ asset_id: 5, height: 480 }, { asset_id: 5, height: 720 }],
            artwork: [{ series_key: "Test", kind: "poster", url: "https://img/poster.jpg", width: 600,
                height: 900, dominant_color: null, placeholder: null }],
            genres: [], titles: [],
        });

        const catalog = await buildCatalog();
        expect(catalog.series).toHaveLength(1);
        expect(catalog.series[0]?.posterImage).toBe("https://img/poster.jpg");
        expect(catalog.series[0]?.episodes[0]).toMatchObject({
            key: "01.mp4", number: 1, sizeBytes: 900, durationSeconds: 1200,
            thumbnail: null,
            media: { status: "ready", heights: [480, 720], previewStartSeconds: 30, hasPreviewClip: true },
        });
    });
});
