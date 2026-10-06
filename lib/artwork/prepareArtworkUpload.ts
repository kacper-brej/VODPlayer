import { ARTWORK_MAX_INPUT_BYTES, ARTWORK_MAX_INPUT_PIXELS, ARTWORK_UPLOAD_TARGET_BYTES } from "./artworkLimits";
import type { MetadataArtworkKind } from "@/lib/upload/uploadWorkflowTypes";

const encode = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Nie udało się przygotować obrazu. Wybierz inny plik.")), "image/webp", quality);
});

export const prepareArtworkUpload = async (file: File, kind: MetadataArtworkKind): Promise<File> => {
    if (file.size === 0) throw new Error("Ten plik jest pusty. Wybierz inne zdjęcie.");
    if (file.size > ARTWORK_MAX_INPUT_BYTES) throw new Error("Zdjęcie przekracza 30 MB. Wybierz mniejszy plik.");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Wybierz zdjęcie w formacie JPG, PNG lub WebP.");

    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error("Nie można otworzyć tego zdjęcia. Spróbuj zapisać je jako JPG, PNG lub WebP.");
    }
    try {
        if (bitmap.width * bitmap.height > ARTWORK_MAX_INPUT_PIXELS) throw new Error("Zdjęcie ma więcej niż 40 megapikseli. Zmniejsz jego rozdzielczość.");
        if (kind === "poster" && bitmap.width >= bitmap.height) throw new Error("Plakat powinien być pionowy. Poziome zdjęcie możesz dodać jako baner.");
        if (kind === "backdrop" && bitmap.width <= bitmap.height) throw new Error("Baner powinien być poziomy. Wybierz zdjęcie szersze niż wyższe.");

        const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
        if (scale === 1 && file.size <= ARTWORK_UPLOAD_TARGET_BYTES) return file;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Przeglądarka nie może przygotować zdjęcia. Spróbuj w innej przeglądarce.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        let blob = await encode(canvas, 0.9);
        if (blob.size > ARTWORK_UPLOAD_TARGET_BYTES) blob = await encode(canvas, 0.75);
        if (blob.size > ARTWORK_UPLOAD_TARGET_BYTES) {
            canvas.width = Math.max(1, Math.round(canvas.width * 0.65));
            canvas.height = Math.max(1, Math.round(canvas.height * 0.65));
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            blob = await encode(canvas, 0.8);
        }
        if (blob.size > ARTWORK_UPLOAD_TARGET_BYTES) throw new Error("Nie udało się zmniejszyć zdjęcia do wysłania. Wybierz mniejszą wersję.");
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type });
    } finally {
        bitmap.close();
    }
};
