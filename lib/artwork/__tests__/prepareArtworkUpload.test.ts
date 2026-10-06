import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareArtworkUpload } from "../prepareArtworkUpload";
import { ARTWORK_MAX_INPUT_BYTES } from "../artworkLimits";
import { assertArtworkInputSize } from "../artworkValidation";

const close = vi.fn();
const drawImage = vi.fn();
const bitmap = vi.fn();
const encode = vi.fn();
beforeEach(() => {
    vi.clearAllMocks();
    bitmap.mockResolvedValue({ width: 4000, height: 2250, close });
    vi.stubGlobal("createImageBitmap", bitmap);
    encode.mockImplementation((callback: (blob: Blob) => void) => callback(new Blob(["optimized"], { type: "image/webp" })));
    vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage }), toBlob: encode }) });
});
afterEach(() => vi.unstubAllGlobals());
describe("przygotowanie własnej grafiki", () => {
    it("akceptuje obraz ponad starym limitem i zmniejsza go przed przesłaniem", async () => {
        const file = new File([new Uint8Array(9 * 1024 * 1024)], "baner.png", { type: "image/png" });
        expect(() => assertArtworkInputSize(file.size)).not.toThrow();
        const prepared = await prepareArtworkUpload(file, "backdrop");
        expect(prepared.type).toBe("image/webp");
        expect(prepared.size).toBeLessThan(3 * 1024 * 1024);
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1440);
        expect(close).toHaveBeenCalledOnce();
    });
    it("odrzuca plik przekraczający 30 MB przed dekodowaniem", async () => {
        const file = new File([new Uint8Array(ARTWORK_MAX_INPUT_BYTES + 1)], "big.png", { type: "image/png" });
        await expect(prepareArtworkUpload(file, "backdrop")).rejects.toThrow("30 MB");
        expect(bitmap).not.toHaveBeenCalled();
        expect(() => assertArtworkInputSize(file.size)).toThrow();
    });
    it("wyjaśnia pomylenie plakatu z banerem i zwalnia bitmapę", async () => {
        await expect(prepareArtworkUpload(new File(["x"], "x.png", { type: "image/png" }), "poster")).rejects.toThrow("Plakat powinien być pionowy");
        expect(close).toHaveBeenCalledOnce();
    });
    it("zostawia małe obrazy bez ponownej kompresji", async () => {
        bitmap.mockResolvedValue({ width: 1200, height: 800, close });
        const file = new File(["small"], "banner.webp", { type: "image/webp" });
        expect(await prepareArtworkUpload(file, "backdrop")).toBe(file);
        expect(encode).not.toHaveBeenCalled();
    });
});
