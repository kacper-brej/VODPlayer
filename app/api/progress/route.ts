import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { saveProgress } from "@/lib/progress/progressService";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "progress", 240, 900)) {
        return NextResponse.json({ error: "Zbyt wiele zapisów postępu." }, { status: 429 });
    }
    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    const body = payload as Record<string, unknown>;
    const result = await saveProgress(user.id, user.username, {
        series: typeof body.series === "string" ? body.series : "",
        episode: typeof body.episode === "string" ? body.episode : "",
        position: body.position,
    });
    if (!result.ok) {
        const status = result.code === "invalid" ? 422 : result.code === "unavailable" ? 404 : 500;
        const message = result.code === "invalid" ? "Nieprawidłowe dane postępu."
            : result.code === "unavailable" ? "Odcinek nie jest dostępny."
                : "Nie udało się zapisać postępu.";
        return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ success: true, completed: result.completed });
};
