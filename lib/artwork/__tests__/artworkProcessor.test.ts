import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processArtwork } from "@/lib/artwork/artworkProcessor";

describe("processArtwork", () => {
    it.each(["jpeg", "png", "webp"] as const)("waliduje i przetwarza %s na podstawie tresci", async (format) => {
        let pipeline = sharp({
            create: { width: 32, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } },
        });
        if (format === "jpeg") pipeline = pipeline.jpeg();
        if (format === "png") pipeline = pipeline.png();
        if (format === "webp") pipeline = pipeline.webp();
        const input = await pipeline.toBuffer();

        const result = await processArtwork(input);

        expect(result.format).toBe(format);
        expect(result.width).toBe(32);
        expect(result.height).toBe(20);
        const [red, green, blue] = result.dominantColor.match(/[0-9A-F]{2}/g)?.map((value) => parseInt(value, 16)) ?? [];
        expect(red).toBeGreaterThanOrEqual(250);
        expect(green).toBeLessThanOrEqual(2);
        expect(blue).toBeLessThanOrEqual(2);
        expect(result.placeholder).toMatch(/^data:image\/jpeg;base64,/);
        expect(Buffer.from(result.placeholder.split(",")[1], "base64").subarray(0, 2))
            .toEqual(Buffer.from([0xff, 0xd8]));
    });

    it("normalizuje reczna grafike do WebP", async () => {
        const input = await sharp({
            create: { width: 24, height: 16, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 0.5 } },
        }).png().toBuffer();

        const result = await processArtwork(input, { normalizeToWebp: true });

        expect(result.format).toBe("webp");
        expect(result.mimeType).toBe("image/webp");
        expect((await sharp(result.data).metadata()).format).toBe("webp");
    });

    it("fizycznie stosuje orientacje EXIF i usuwa zaleznosc od metadanych klienta", async () => {
        const input = await sharp({
            create: { width: 30, height: 20, channels: 3, background: "navy" },
        }).jpeg().withMetadata({ orientation: 6 }).toBuffer();

        const result = await processArtwork(input);
        const metadata = await sharp(result.data).metadata();

        expect([result.width, result.height]).toEqual([20, 30]);
        expect(metadata.orientation).toBeUndefined();
    });

    it("odrzuca uszkodzone i nieobslugiwane pliki", async () => {
        await expect(processArtwork(Buffer.from("not an image")))
            .rejects.toMatchObject({ code: "invalid_image" });

        const gif = await sharp({
            create: { width: 2, height: 2, channels: 3, background: "red" },
        }).gif().toBuffer();
        await expect(processArtwork(gif)).rejects.toMatchObject({ code: "unsupported_format" });
    });

    it("odrzuca obraz przekraczajacy limit pikseli przed dekodowaniem", async () => {
        const input = await sharp({
            create: { width: 101, height: 101, channels: 3, background: "red" },
        }).png().toBuffer();

        await expect(processArtwork(input, { maxInputPixels: 10_000 }))
            .rejects.toMatchObject({ code: "pixel_limit" });
    });

    it("odrzuca pusty i zbyt duzy bufor", async () => {
        await expect(processArtwork(Buffer.alloc(0))).rejects.toMatchObject({ code: "empty_input" });
        await expect(processArtwork(Buffer.alloc(5), { maxInputBytes: 4 }))
            .rejects.toMatchObject({ code: "input_too_large" });
    });
});
