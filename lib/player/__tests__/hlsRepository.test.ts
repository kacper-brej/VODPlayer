import { describe, expect, it, vi, beforeEach } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const { findReadyHlsAsset } = await import("../hlsRepository");

beforeEach(() => execute.mockReset());

describe("findReadyHlsAsset", () => {
    it("laczy media_renditions z media_assets, filtruje tylko status='ready'", async () => {
        execute.mockResolvedValueOnce([[]]);
        await findReadyHlsAsset(42, 7, "Frieren", "01.mp4");

        const [sql, params] = execute.mock.calls[0] as [string, unknown[]];
        expect(sql).toMatch(/JOIN media_assets a ON a\.id = r\.asset_id/);
        expect(sql).toMatch(/a\.status = 'ready'/);
        expect(params).toEqual([42, 7, "Frieren", "01.mp4"]);
    });

    it("sortuje po bitrate_kbps rosnaco", async () => {
        execute.mockResolvedValueOnce([[]]);
        await findReadyHlsAsset(42, 7, "Frieren", "01.mp4");
        expect(execute).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY r\.bitrate_kbps ASC/), expect.any(Array));
    });

    it("mapuje wiersze na HlsRendition (camelCase)", async () => {
        execute.mockResolvedValueOnce([[
            { asset_id: 42, asset_version: 7, duration_seconds: 1500, height: 480, width: 854, bitrate_kbps: 1200, playlist_key: "media/Frieren/01.mp4/480p/index.m3u8" },
        ]]);

        await expect(findReadyHlsAsset(42, 7, "Frieren", "01.mp4")).resolves.toEqual({
            id: 42,
            version: 7,
            durationSeconds: 1500,
            renditions: [{ height: 480, width: 854, bitrateKbps: 1200, playlistKey: "media/Frieren/01.mp4/480p/index.m3u8" }],
        });
    });

    it("brak gotowego assetu -> pusta lista", async () => {
        execute.mockResolvedValueOnce([[]]);
        await expect(findReadyHlsAsset(42, 7, "Nieznany", "01.mp4")).resolves.toBeNull();
    });
});
