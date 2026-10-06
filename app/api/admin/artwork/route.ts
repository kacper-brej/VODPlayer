import { requireAdminRoute } from "@/lib/http/routeAuth";
import { invalidateCatalogCache } from "@/lib/catalog/seriesMetadata";
import { ARTWORK_MAX_INPUT_BYTES } from "@/lib/artwork/artworkValidation";
import {
    isArtworkKind,
    isSafeArtworkSeriesKey,
    saveManualArtwork,
} from "@/lib/artwork/artworkService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (payload: unknown, status = 200) => Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
});

export const POST = async (request: Request) => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return json({ error: "Nieprawidłowe dane formularza." }, 400);
    }

    const file = formData.get("file");
    const seriesKey = formData.get("seriesKey");
    const kind = formData.get("kind");

    if (
        !(file instanceof File)
        || typeof seriesKey !== "string"
        || typeof kind !== "string"
        || !isSafeArtworkSeriesKey(seriesKey)
        || !isArtworkKind(kind)
    ) {
        return json({ error: "Nieprawidłowe dane grafiki." }, 422);
    }

    if (file.size < 1 || file.size > ARTWORK_MAX_INPUT_BYTES) {
        return json({ error: "Wybierz zdjęcie JPG, PNG lub WebP do 30 MB." }, 422);
    }

    try {
        const result = await saveManualArtwork(seriesKey, kind, Buffer.from(await file.arrayBuffer()));
        if (!result.ok) {
            if (result.code === "invalid") {
                return json({ error: "Nie można odczytać zdjęcia. Wybierz JPG, PNG lub WebP do 30 MB i 40 megapikseli." }, 415);
            }
            if (result.code === "invalid_dimensions") {
                return json({ error: kind === "poster" ? "Plakat powinien być pionowy. Poziome zdjęcie możesz dodać jako baner." : "Baner powinien być poziomy. Wybierz zdjęcie szersze niż wyższe." }, 422);
            }
            if (result.code === "not_found") return json({ error: "Tego materiału nie ma już w bibliotece. Odśwież listę i wybierz go ponownie." }, 404);
            if (result.code === "storage") return json({ error: "Magazyn plików nie odpowiada. Spróbuj wysłać zdjęcie ponownie za chwilę." }, 502);
            return json({ error: "Nie udało się zapisać grafiki." }, 500);
        }

        invalidateCatalogCache();
        return json({ success: true, id: result.id, url: result.url });
    } catch (error) {
        console.error("POST /api/admin/artwork: nieoczekiwany błąd", error);
        return json({ error: "Nie udało się zapisać grafiki." }, 500);
    }
};
