import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    ArtworkValidationError,
    downloadArtwork,
    validateArtworkSourceUrl,
} from "@/lib/artwork/artworkValidation";

const expectCode = async (promise: Promise<unknown>, code: string) => {
    await expect(promise).rejects.toMatchObject({ code });
};

describe("validateArtworkSourceUrl", () => {
    it.each([
        "https://image.tmdb.org/t/p/original/poster.jpg",
        "https://s4.anilist.co/file/anilistcdn/media/anime/banner/1.jpg",
        "https://cdn.myanimelist.net/images/anime/1/2.webp",
        "https://img.youtube.com/vi/id/maxresdefault.jpg",
        "https://i.ytimg.com/vi/id/maxresdefault.jpg",
    ])("akceptuje znany host providera: %s", (url) => {
        expect(validateArtworkSourceUrl(url).href).toBe(url);
    });

    it.each([
        "http://image.tmdb.org/t/p/original/poster.jpg",
        "https://image.tmdb.org.evil.test/poster.jpg",
        "https://127.0.0.1/poster.jpg",
        "https://localhost/poster.jpg",
        "https://user:password@image.tmdb.org/poster.jpg",
        "https://image.tmdb.org:8443/poster.jpg",
        "not-a-url",
    ])("odrzuca URL mogacy ominac allowliste: %s", (url) => {
        expect(() => validateArtworkSourceUrl(url)).toThrow(ArtworkValidationError);
        expect(() => validateArtworkSourceUrl(url)).toThrow(expect.objectContaining({ code: "unsafe_url" }));
    });
});

describe("downloadArtwork", () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    beforeEach(() => {
        fetchImplementation.mockReset();
    });

    it("pobiera dozwolony obraz i sprawdza kazde przekierowanie", async () => {
        fetchImplementation
            .mockResolvedValueOnce(new Response(null, {
                status: 302,
                headers: { location: "https://cdn.myanimelist.net/final.webp" },
            }))
            .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
                headers: { "content-length": "3" },
            }));

        const result = await downloadArtwork("https://s4.anilist.co/start", { fetchImplementation });

        expect(result).toEqual(Buffer.from([1, 2, 3]));
        expect(fetchImplementation).toHaveBeenCalledTimes(2);
        expect(fetchImplementation.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
    });

    it("odrzuca przekierowanie do sieci lokalnej", async () => {
        fetchImplementation.mockResolvedValueOnce(new Response(null, {
            status: 302,
            headers: { location: "http://127.0.0.1/internal" },
        }));

        await expectCode(
            downloadArtwork("https://image.tmdb.org/start", { fetchImplementation }),
            "unsafe_url",
        );
        expect(fetchImplementation).toHaveBeenCalledOnce();
    });

    it("odrzuca deklarowana odpowiedz wieksza od limitu bez czytania body", async () => {
        fetchImplementation.mockResolvedValueOnce(new Response(new Uint8Array([1]), {
            status: 200,
            headers: { "content-length": "5" },
        }));

        await expectCode(
            downloadArtwork("https://image.tmdb.org/poster", { fetchImplementation, maxBytes: 4 }),
            "input_too_large",
        );
    });

    it("pilnuje limitu takze bez naglowka content-length", async () => {
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3]));
                controller.enqueue(new Uint8Array([4, 5, 6]));
                controller.close();
            },
        });
        fetchImplementation.mockResolvedValueOnce(new Response(stream, { status: 200 }));

        await expectCode(
            downloadArtwork("https://s4.anilist.co/poster", { fetchImplementation, maxBytes: 4 }),
            "input_too_large",
        );
    });
});
