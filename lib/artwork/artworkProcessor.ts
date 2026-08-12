import "server-only";
import sharp from "sharp";
import {
    ARTWORK_MAX_INPUT_BYTES,
    ARTWORK_MAX_INPUT_PIXELS,
    ArtworkValidationError,
    assertArtworkInputSize,
    downloadArtwork,
    type DownloadArtworkOptions,
} from "@/lib/artwork/artworkValidation";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ArtworkProcessingErrorCode = "invalid_image" | "unsupported_format" | "pixel_limit";

export class ArtworkProcessingError extends Error {
    constructor(public readonly code: ArtworkProcessingErrorCode) {
        super(code);
        this.name = "ArtworkProcessingError";
    }
}

export interface ProcessArtworkOptions {
    normalizeToWebp?: boolean;
    maxInputBytes?: number;
    maxInputPixels?: number;
}

export interface ProcessedArtwork {
    data: Buffer;
    format: "jpeg" | "png" | "webp";
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    width: number;
    height: number;
    dominantColor: string;
    placeholder: string;
}

const mimeTypeFor = (format: ProcessedArtwork["format"]): ProcessedArtwork["mimeType"] => {
    if (format === "png") return "image/png";
    if (format === "webp") return "image/webp";
    return "image/jpeg";
};

const toHex = (value: number): string => Math.round(value).toString(16).padStart(2, "0").toUpperCase();

const computeDominantColor = async (input: Buffer, maxInputPixels: number): Promise<string> => {
    const { data, info } = await sharp(input, {
        failOn: "error",
        limitInputPixels: maxInputPixels,
        sequentialRead: true,
    })
        .resize(8, 8, { fit: "fill" })
        .flatten({ background: "#000000" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    let red = 0;
    let green = 0;
    let blue = 0;

    for (let offset = 0; offset < data.length; offset += info.channels) {
        red += data[offset];
        green += data[offset + 1];
        blue += data[offset + 2];
    }

    const samples = info.width * info.height;
    return `#${toHex(red / samples)}${toHex(green / samples)}${toHex(blue / samples)}`;
};

const computePlaceholder = async (input: Buffer, maxInputPixels: number): Promise<string> => {
    const bytes = await sharp(input, {
        failOn: "error",
        limitInputPixels: maxInputPixels,
        sequentialRead: true,
    })
        .resize(16, 16, { fit: "fill" })
        .flatten({ background: "#000000" })
        .jpeg({ quality: 40 })
        .toBuffer();

    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
};

export const processArtwork = async (
    input: Buffer | Uint8Array,
    options: ProcessArtworkOptions = {},
): Promise<ProcessedArtwork> => {
    const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const maxInputBytes = Math.min(options.maxInputBytes ?? ARTWORK_MAX_INPUT_BYTES, ARTWORK_MAX_INPUT_BYTES);
    const maxInputPixels = Math.min(options.maxInputPixels ?? ARTWORK_MAX_INPUT_PIXELS, ARTWORK_MAX_INPUT_PIXELS);
    assertArtworkInputSize(bytes.byteLength, maxInputBytes);

    try {
        const metadata = await sharp(bytes, {
            failOn: "error",
            limitInputPixels: false,
            sequentialRead: true,
        }).metadata();

        if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
            throw new ArtworkProcessingError("unsupported_format");
        }
        if (!metadata.width || !metadata.height) {
            throw new ArtworkProcessingError("invalid_image");
        }
        const inputPixels = metadata.width * metadata.height * (metadata.pages ?? 1);
        if (inputPixels > maxInputPixels) {
            throw new ArtworkProcessingError("pixel_limit");
        }

        let pipeline = sharp(bytes, {
            failOn: "error",
            limitInputPixels: maxInputPixels,
            sequentialRead: true,
        }).rotate();

        if (options.normalizeToWebp) {
            pipeline = pipeline.webp({ quality: 88, alphaQuality: 90, effort: 4 });
        }

        const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
        if (!info.width || !info.height || !ALLOWED_FORMATS.has(info.format)) {
            throw new ArtworkProcessingError("invalid_image");
        }

        const format = info.format as ProcessedArtwork["format"];
        const [dominantColor, placeholder] = await Promise.all([
            computeDominantColor(data, maxInputPixels),
            computePlaceholder(data, maxInputPixels),
        ]);

        return {
            data,
            format,
            mimeType: mimeTypeFor(format),
            width: info.width,
            height: info.height,
            dominantColor,
            placeholder,
        };
    } catch (error) {
        if (error instanceof ArtworkValidationError || error instanceof ArtworkProcessingError) throw error;
        throw new ArtworkProcessingError("invalid_image");
    }
};

export const downloadAndProcessArtwork = async (
    source: string | URL,
    processingOptions: ProcessArtworkOptions = {},
    downloadOptions: DownloadArtworkOptions = {},
): Promise<ProcessedArtwork> => {
    const data = await downloadArtwork(source, {
        ...downloadOptions,
        maxBytes: processingOptions.maxInputBytes ?? downloadOptions.maxBytes,
    });
    return processArtwork(data, processingOptions);
};
