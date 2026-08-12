import { NextResponse } from "next/server";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parsePositiveId } from "@/lib/http/routeParams";
import { getCollectionDetail, renameCollection, deleteCollection } from "@/lib/collections/collectionService";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const id = parsePositiveId((await context.params).id);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator kolekcji." }, { status: 422 });

    const result = await getCollectionDetail(user.id, user.username, id);
    if (!result.ok) {
        const status = result.code === "forbidden" ? 403 : 422;
        const message = result.code === "forbidden" ? "Kolekcja nie należy do tego profilu." : "Nieprawidłowy identyfikator kolekcji.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(result.detail);
};

export const PATCH = async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "collections", 30, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const id = parsePositiveId((await context.params).id);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator kolekcji." }, { status: 422 });

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    const name = payload && typeof payload === "object" && "name" in payload && typeof payload.name === "string"
        ? payload.name
        : "";

    const result = await renameCollection(user.id, user.username, id, name);
    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Nazwa kolekcji musi mieć od 1 do 100 znaków.",
            forbidden: "Kolekcja nie należy do tego profilu.",
            conflict: "Kolekcja o tej nazwie już istnieje.",
            server: "Nie udało się zmienić nazwy kolekcji.",
        };
        const status = result.code === "forbidden" ? 403 : result.code === "server" ? 500 : 422;
        return NextResponse.json({ error: messages[result.code] }, { status });
    }

    return NextResponse.json({ id: result.id, name: result.name });
};

export const DELETE = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "collections", 30, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const id = parsePositiveId((await context.params).id);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator kolekcji." }, { status: 422 });

    const result = await deleteCollection(user.id, user.username, id);
    if (!result.ok) {
        const status = result.code === "forbidden" ? 403 : 500;
        const message = result.code === "forbidden" ? "Kolekcja nie należy do tego profilu." : "Nie udało się usunąć kolekcji.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true });
};
