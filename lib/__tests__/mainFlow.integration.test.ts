import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const connectionExecute = vi.fn();
const fakeConnection = {
    execute: connectionExecute,
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
};
const fakePool = { execute, getConnection: vi.fn().mockResolvedValue(fakeConnection) };
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => fakePool }));
vi.mock("@/lib/core/vodConfig", () => ({ selectedProfileId: async () => null }));
vi.mock("@/lib/access/entitlements", () => ({ getViewerSeriesAccessLevel: async () => "full" }));

const { getContinueWatching, saveProgress } = await import("@/lib/progress/progressService");

beforeEach(() => {
    vi.clearAllMocks();
    execute.mockReset();
    connectionExecute.mockReset();
});

describe("profil -> gotowy asset -> watch_progress -> projekcja Continue Watching", () => {
    it("zapis i odczyt używają tego samego profilu oraz watch_progress", async () => {
        execute.mockResolvedValueOnce([[{ id: 5 }]]);
        connectionExecute
            .mockResolvedValueOnce([[{ id: 8, asset_version: 7, series_key: "Naruto", episode_key: "01.mp4", duration_seconds: 1200 }]])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[{ completed: 0 }]]);

        await expect(saveProgress(1, "Kacper", { series: "Naruto", episode: "01.mp4", position: 45 }))
            .resolves.toEqual({ ok: true, completed: false });
        expect(connectionExecute.mock.calls[1]?.[1]).toEqual([5, 8, 7, "Naruto", "01.mp4", 45, 1200, 0]);

        execute
            .mockResolvedValueOnce([[{ id: 5 }]])
            .mockResolvedValueOnce([[
                { series_key: "Naruto", episode_key: "01.mp4", position_seconds: 45, duration_seconds: 1200, completed: 0, updated_at: 1_700_000_000 },
            ]]);

        await expect(getContinueWatching(1, "Kacper")).resolves.toEqual([
            { seriesKey: "Naruto", episodeKey: "01.mp4", positionSeconds: 45, durationSeconds: 1200, updatedAt: 1_700_000_000 },
        ]);
        expect(execute.mock.calls.at(-1)?.[0]).toContain("FROM watch_progress");
        expect(execute.mock.calls.at(-1)?.[0]).not.toContain("continue_watching");
    });

    it("niedostępny asset nie tworzy progresu", async () => {
        execute.mockResolvedValueOnce([[{ id: 5 }]]);
        connectionExecute.mockResolvedValueOnce([[]]);
        await expect(saveProgress(1, "Kacper", { series: "Ghost", episode: "01", position: 10 }))
            .resolves.toEqual({ ok: false, code: "unavailable" });
        expect(connectionExecute).toHaveBeenCalledTimes(1);
    });
});
