import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parsePositiveId } from "@/lib/http/routeParams";
import { removeFromCollection } from "@/lib/collections/collectionService";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = async (_request: Request, context: { params: Promise<{ id: string; seriesKey: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "collections", 30, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const { id: rawId, seriesKey } = await context.params;
    const id = parsePositiveId(rawId);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator kolekcji." }, { status: 422 });

    const result = await removeFromCollection(user.id, user.username, id, decodeURIComponent(seriesKey));
    if (!result.ok) {
        const status = result.code === "forbidden" ? 403 : result.code === "server" ? 500 : 422;
        const message = result.code === "forbidden" ? "Kolekcja nie należy do tego profilu." : "Nie udało się usunąć tytułu z kolekcji.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true });
};
