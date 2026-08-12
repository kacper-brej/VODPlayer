import { NextResponse } from "next/server";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parsePositiveId } from "@/lib/http/routeParams";
import { addToCollection } from "@/lib/collections/collectionService";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "collections", 30, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const id = parsePositiveId((await context.params).id);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator kolekcji." }, { status: 422 });

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    const series = payload && typeof payload === "object" && "series" in payload && typeof payload.series === "string"
        ? payload.series
        : "";

    const result = await addToCollection(user.id, user.username, id, series);
    if (!result.ok) {
        const status = result.code === "forbidden" ? 403 : result.code === "server" ? 500 : 422;
        const message = result.code === "forbidden"
            ? "Kolekcja nie należy do tego profilu."
            : result.code === "server"
                ? "Nie udało się dodać tytułu do kolekcji."
                : "Brak identyfikatora serialu.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true, seriesKey: result.seriesKey }, { status: 201 });
};
