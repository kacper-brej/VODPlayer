import { buildArtworkRedirect } from "@/lib/artwork/artworkService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (status: number, message: string) => Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
);

export const GET = async (request: Request) => {
    const rawId = new URL(request.url).searchParams.get("id") ?? "";
    if (!/^\d+$/.test(rawId)) return fail(400, "Nieprawidłowy identyfikator grafiki.");

    const artworkId = Number(rawId);
    if (!Number.isSafeInteger(artworkId) || artworkId < 1) {
        return fail(400, "Nieprawidłowy identyfikator grafiki.");
    }

    const result = await buildArtworkRedirect(artworkId);
    if (!result.ok) {
        if (result.code === "not_found") return fail(404, "Grafika nie istnieje.");
        if (result.code === "storage") return fail(502, "Nie udało się pobrać grafiki z B2.");
        return fail(500, "Błąd serwera.");
    }

    return new Response(null, {
        status: 302,
        headers: {
            Location: result.url,
            "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
            "X-Content-Type-Options": "nosniff",
        },
    });
};

export const HEAD = GET;
