import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionExecute = vi.fn();
vi.mock("@/lib/db/transaction", () => ({
    withTransaction: (work: (connection: { execute: typeof transactionExecute }) => unknown) =>
        work({ execute: transactionExecute }),
}));

const { registerFileAsset } = await import("../libraryRegistrationRepository");
const pool = {} as never;

beforeEach(() => transactionExecute.mockReset());

describe("libraryRegistrationRepository", () => {
    it("rejestruje nowy plik MP4 razem z jego rozmiarem", async () => {
        transactionExecute
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        await expect(registerFileAsset("Tokyo Ghoul √A", "03.mp4", null, 1234, pool))
            .resolves.toBe("inserted");
        expect(transactionExecute).toHaveBeenNthCalledWith(
            3,
            expect.stringMatching(/delivery, storage_prefix, container[\s\S]+source_size_bytes, total_size_bytes/),
            ["Tokyo Ghoul √A", "03.mp4", "uploads/Tokyo Ghoul √A", null, 1234, 1234],
        );
    });

    it.each(["deleted", "delete_failed"])(
        "reaktywuje plik po wpisie ze statusem %s",
        async (status) => {
            transactionExecute
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([[{ id: 7, status }]])
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([{ affectedRows: 1 }]);

            await expect(registerFileAsset("Tokyo Ghoul √A", "03.mp4", "03.preview.mp4", 4321, pool))
                .resolves.toBe("inserted");
            expect(transactionExecute).toHaveBeenNthCalledWith(
                3,
                expect.stringMatching(/DELETE FROM media_renditions/),
                [7],
            );
            expect(transactionExecute).toHaveBeenNthCalledWith(
                4,
                expect.stringMatching(/status = 'ready'[\s\S]+delivery = 'file'[\s\S]+asset_version = asset_version \+ 1/),
                ["uploads/Tokyo Ghoul √A", "03.preview.mp4", 4321, 4321, 7],
            );
        },
    );

    it("nie nadpisuje aktywnego wpisu HLS", async () => {
        transactionExecute
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[{ id: 7, status: "ready" }]]);

        await expect(registerFileAsset("Tokyo Ghoul √A", "01.mp4", null, 1234, pool))
            .resolves.toBe("exists");
        expect(transactionExecute).toHaveBeenCalledTimes(2);
    });
});
