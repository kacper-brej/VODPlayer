import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { listCollections, createCollection } from "@/lib/collections/collectionService";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const collections = await listCollections(user.id, user.username);
    return NextResponse.json({ collections });
};

export const POST = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "collections", 30, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    const name = payload && typeof payload === "object" && "name" in payload && typeof payload.name === "string"
        ? payload.name
        : "";

    const result = await createCollection(user.id, user.username, name);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Nazwa kolekcji musi mieć od 1 do 100 znaków.",
            limit: "Osiągnięto limit dwudziestu kolekcji na profil.",
            conflict: "Kolekcja o tej nazwie już istnieje.",
            server: "Nie udało się utworzyć kolekcji.",
        };
        const status = result.code === "invalid" || result.code === "limit" || result.code === "conflict" ? 422 : 500;
        return NextResponse.json({ error: messages[result.code] }, { status });
    }

    return NextResponse.json({ id: result.id, name: result.name, createdAt: result.createdAt }, { status: 201 });
};
