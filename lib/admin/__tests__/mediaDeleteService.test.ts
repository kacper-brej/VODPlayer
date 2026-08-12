import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteB2Prefix = vi.fn();
class MockDeleteB2ConfigError extends Error {}
vi.mock("@/lib/admin/b2AdminStorage", () => ({
    deleteB2Prefix,
    DeleteB2ConfigError: MockDeleteB2ConfigError,
}));

const beginMediaDeletion = vi.fn();
const finalizeMediaDeletion = vi.fn();
const markMediaDeletionFailed = vi.fn();
vi.mock("@/lib/admin/mediaDeleteRepository", () => ({
    beginMediaDeletion,
    finalizeMediaDeletion,
    markMediaDeletionFailed,
}));

const { deleteMedia } = await import("../mediaDeleteService");

beforeEach(() => {
    vi.clearAllMocks();
    finalizeMediaDeletion.mockResolvedValue(true);
    markMediaDeletionFailed.mockResolvedValue(undefined);
});

describe("deleteMedia lifecycle", () => {
    it("awaria DB przed oznaczeniem deleting nie dotyka B2", async () => {
        beginMediaDeletion.mockRejectedValue(new Error("db unavailable"));
        await expect(deleteMedia("Test", "01.mp4")).rejects.toThrow("db unavailable");
        expect(deleteB2Prefix).not.toHaveBeenCalled();
    });

    it("awaria B2 zostawia retryable delete_failed, a ponowienie jest skuteczne", async () => {
        beginMediaDeletion.mockResolvedValue({
            kind: "claimed", assetId: 7, storagePrefix: "media/Test/01.mp4",
        });
        deleteB2Prefix.mockRejectedValueOnce(new Error("B2 timeout")).mockResolvedValueOnce(12);

        await expect(deleteMedia("Test", "01.mp4")).rejects.toThrow("B2 timeout");
        expect(markMediaDeletionFailed).toHaveBeenCalledWith(7, expect.stringContaining("ponowić"));

        await expect(deleteMedia("Test", "01.mp4")).resolves.toMatchObject({
            ok: true,
            state: "deleted",
            deletedB2Objects: 12,
        });
    });

    it("równoległy delete z aktywną dzierżawą nie uruchamia drugiego kasowania B2", async () => {
        beginMediaDeletion
            .mockResolvedValueOnce({ kind: "claimed", assetId: 7, storagePrefix: "media/Test/01.mp4" })
            .mockResolvedValueOnce({ kind: "in_progress", assetId: 7 });
        let release!: () => void;
        deleteB2Prefix.mockImplementationOnce(() => new Promise<number>((resolve) => { release = () => resolve(3); }));

        const first = deleteMedia("Test", "01.mp4");
        await expect(deleteMedia("Test", "01.mp4")).resolves.toMatchObject({ state: "in_progress" });
        expect(deleteB2Prefix).toHaveBeenCalledTimes(1);
        release();
        await expect(first).resolves.toMatchObject({ state: "deleted" });
    });

    it("nigdy nie kasuje prefixu innego assetu zapisanego w DB", async () => {
        beginMediaDeletion.mockResolvedValue({
            kind: "claimed", assetId: 7, storagePrefix: "media/Inny/01.mp4",
        });
        await expect(deleteMedia("Test", "01.mp4")).resolves.toEqual({
            ok: false,
            code: "unsafe_prefix",
        });
        expect(deleteB2Prefix).not.toHaveBeenCalled();
        expect(markMediaDeletionFailed).toHaveBeenCalled();
    });

    it("awaria finalizacji DB po B2 pozostawia operację do retry", async () => {
        beginMediaDeletion.mockResolvedValue({
            kind: "claimed", assetId: 7, storagePrefix: "media/Test/01.mp4",
        });
        deleteB2Prefix.mockResolvedValue(3);
        finalizeMediaDeletion.mockRejectedValue(new Error("commit failed"));
        await expect(deleteMedia("Test", "01.mp4")).rejects.toThrow("commit failed");
        expect(markMediaDeletionFailed).toHaveBeenCalledWith(7, expect.any(String));
    });
});
