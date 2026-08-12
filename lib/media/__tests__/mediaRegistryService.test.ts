import { beforeEach, describe, expect, it, vi } from "vitest";

const OPERATION_ID = "a".repeat(64);

const registerStart = vi.fn();
const registerComplete = vi.fn();
const registerFailed = vi.fn();
vi.mock("@/lib/media/mediaRegistryRepository", () => ({ registerStart, registerComplete, registerFailed }));

const { MediaRegistryValidationError, parseMediaRegistration, saveMediaRegistration } = await import("../mediaRegistryService");

beforeEach(() => vi.clearAllMocks());

describe("mediaRegistryService", () => {
    it("waliduje i zapisuje fazę start", async () => {
        registerStart.mockResolvedValue({ assetId: 7, status: "processing" });
        const input = parseMediaRegistration({
            phase: "start", seriesKey: " Test ", episodeKey: "01.mp4", operationId: OPERATION_ID,
            storagePrefix: "media/Test/01.mp4", durationSeconds: 120,
            sourceSizeBytes: 500, previewStartSeconds: 30,
        });
        await expect(saveMediaRegistration(input)).resolves.toEqual({ assetId: 7, status: "processing" });
        expect(registerStart).toHaveBeenCalledWith(expect.objectContaining({ seriesKey: "Test" }));
    });

    it("odrzuca zduplikowane renditiony", () => {
        expect(() => parseMediaRegistration({
            phase: "complete", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            totalSizeBytes: 10, previewClipKey: null,
            renditions: [
                { height: 720, width: 1280, bitrateKbps: 1000, playlistKey: "media/Test/01.mp4/720p/index.m3u8", segmentCount: 1, sizeBytes: 5 },
                { height: 720, width: 1280, bitrateKbps: 1000, playlistKey: "media/Test/01.mp4/720p/index.m3u8", segmentCount: 1, sizeBytes: 5 },
            ],
        })).toThrow(MediaRegistryValidationError);
    });

    it("odrzuca playlistę należącą do innego assetu", () => {
        expect(() => parseMediaRegistration({
            phase: "complete", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            totalSizeBytes: 10, previewClipKey: "media/Test/01.mp4/preview.mp4",
            renditions: [{ height: 480, width: 854, bitrateKbps: 1000,
                playlistKey: "media/Inny/01.mp4/480p/index.m3u8", segmentCount: 1, sizeBytes: 5 }],
        })).toThrow(MediaRegistryValidationError);
    });

    it.each([
        "media/Test/01.mp4/../secret/480p/index.m3u8",
        "media/Test/01.mp4/%2e%2e/480p/index.m3u8",
        "https://example.com/index.m3u8",
        "media\\Test\\01.mp4\\480p\\index.m3u8",
        "media/Test/01.mp4//480p/index.m3u8",
    ])("odrzuca niekanoniczny lub traversal playlistKey: %s", (playlistKey) => {
        expect(() => parseMediaRegistration({
            phase: "complete", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            totalSizeBytes: 10, previewClipKey: null,
            renditions: [{ height: 480, width: 854, bitrateKbps: 1000,
                playlistKey, segmentCount: 1, sizeBytes: 5 }],
        })).toThrow(MediaRegistryValidationError);
    });

    it("normalizuje previewStart do duration minus jedna sekunda", () => {
        const input = parseMediaRegistration({
            phase: "start", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            storagePrefix: "media/Test/01.mp4", durationSeconds: 120,
            sourceSizeBytes: 500, previewStartSeconds: 999,
        });
        expect(input).toMatchObject({ previewStartSeconds: 119 });
    });

    it("odrzuca ścieżki wychodzące poza media/", () => {
        expect(() => parseMediaRegistration({
            phase: "start", seriesKey: "Test", episodeKey: "01.mp4", operationId: OPERATION_ID,
            storagePrefix: "media/../secret", durationSeconds: 120,
            sourceSizeBytes: 1, previewStartSeconds: 0,
        })).toThrow(MediaRegistryValidationError);
    });
});
