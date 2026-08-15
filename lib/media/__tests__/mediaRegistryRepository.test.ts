import { beforeEach, describe, expect, it, vi } from "vitest";

const OPERATION_ID = "a".repeat(64);

const transactionExecute = vi.fn();
vi.mock("@/lib/db/transaction", () => ({
    withTransaction: (work: (connection: { execute: typeof transactionExecute }) => unknown) =>
        work({ execute: transactionExecute }),
}));

const { registerComplete, registerFailed, registerStart } = await import("../mediaRegistryRepository");

beforeEach(() => transactionExecute.mockReset());

describe("mediaRegistryRepository", () => {
    it("start tworzy identity i asset atomowo", async () => {
        transactionExecute
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 17 }]);

        await expect(registerStart({
            phase: "start", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            storagePrefix: "media/Test/01.mp4", durationSeconds: 120,
            sourceSizeBytes: 1000, previewStartSeconds: 20,
        })).resolves.toEqual({ assetId: 17, status: "processing" });
        expect(transactionExecute).toHaveBeenCalledWith(
            expect.stringContaining("INSERT IGNORE INTO series_identities"),
            ["Test"],
        );
        expect(transactionExecute).toHaveBeenCalledWith(expect.stringMatching(/FOR UPDATE/), ["Test", "01.mp4"]);
    });

    it("duplicate start gotowego assetu nie cofa ready", async () => {
        transactionExecute.mockResolvedValueOnce([{}]).mockResolvedValueOnce([[
            { id: 17, status: "ready", storage_prefix: "media/Test/01.mp4", operation_id: OPERATION_ID },
        ]]);

        await expect(registerStart({
            phase: "start", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            storagePrefix: "media/Test/01.mp4", durationSeconds: 120,
            sourceSizeBytes: 1000, previewStartSeconds: 20,
        })).resolves.toEqual({ assetId: 17, status: "already_ready" });
    });

    it("complete blokuje asset, podmienia renditiony i ustawia ready w jednej transakcji", async () => {
        transactionExecute.mockResolvedValueOnce([[
            { id: 9, status: "processing", storage_prefix: "media/Test/01.mp4", operation_id: OPERATION_ID },
        ]]).mockResolvedValue([{}]);

        await expect(registerComplete({
            phase: "complete", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            totalSizeBytes: 500, previewClipKey: "media/Test/01.mp4/preview.mp4",
            renditions: [{ height: 720, width: 1280, bitrateKbps: 2000,
                playlistKey: "media/Test/01.mp4/720p/index.m3u8", segmentCount: 10, sizeBytes: 400 }],
        })).resolves.toEqual({ assetId: 9, status: "ready" });
        expect(transactionExecute).toHaveBeenCalledWith(expect.stringMatching(/FOR UPDATE/), ["Test", "01.mp4"]);
        expect(transactionExecute).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM media_renditions/), [9]);
        expect(transactionExecute).toHaveBeenCalledWith(expect.stringMatching(/SET status = 'ready'/), [500, "media/Test/01.mp4/preview.mp4", 9]);
        expect(transactionExecute).toHaveBeenCalledWith(
            expect.stringMatching(/INSERT IGNORE INTO notifications[\s\S]*FROM watchlist/),
            ["01.mp4", "Test"],
        );
        expect(transactionExecute).toHaveBeenCalledWith(
            expect.stringMatching(/DELETE FROM notifications WHERE created_at/),
        );
    });

    it("duplicate complete jest idempotentny", async () => {
        transactionExecute.mockResolvedValueOnce([[
            { id: 9, status: "ready", storage_prefix: "media/Test/01.mp4", operation_id: OPERATION_ID },
        ]]);
        await expect(registerComplete({
            phase: "complete", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            totalSizeBytes: 500, previewClipKey: null,
            renditions: [{ height: 480, width: 854, bitrateKbps: 1200,
                playlistKey: "media/Test/01.mp4/480p/index.m3u8", segmentCount: 10, sizeBytes: 400 }],
        })).resolves.toEqual({ assetId: 9, status: "already_ready" });
        expect(transactionExecute).toHaveBeenCalledTimes(1);
    });

    it("complete po deleting jest odrzucony bez zmiany renditionow", async () => {
        transactionExecute.mockResolvedValueOnce([[
            { id: 9, status: "deleting", storage_prefix: "media/Test/01.mp4", operation_id: OPERATION_ID },
        ]]);
        await expect(registerComplete({
            phase: "complete", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            totalSizeBytes: 500, previewClipKey: null,
            renditions: [{ height: 480, width: 854, bitrateKbps: 1200,
                playlistKey: "media/Test/01.mp4/480p/index.m3u8", segmentCount: 10, sizeBytes: 400 }],
        })).resolves.toEqual({ assetId: 9, status: "conflict" });
        expect(transactionExecute).toHaveBeenCalledTimes(1);
    });

    it("failed nie nadpisuje gotowego assetu", async () => {
        transactionExecute.mockResolvedValueOnce([[
            { id: 4, status: "ready", storage_prefix: "media/Test/01.mp4", operation_id: OPERATION_ID },
        ]]);
        await expect(registerFailed("Test", "01.mp4", OPERATION_ID, "błąd")).resolves.toEqual({
            assetId: 4,
            status: "already_ready",
        });
    });
});
