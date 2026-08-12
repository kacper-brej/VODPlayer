import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parsePositiveId } from "@/lib/http/routeParams";
import { markNotificationRead } from "@/lib/notifications/notificationService";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "notifications", 120, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const id = parsePositiveId((await context.params).id);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator powiadomienia." }, { status: 422 });

    const result = await markNotificationRead(user.id, user.username, id);
    if (!result.ok) {
        const status = result.code === "server" ? 500 : 422;
        const message = result.code === "server" ? "Nie udało się oznaczyć powiadomienia jako przeczytane." : "Nieprawidłowy identyfikator powiadomienia.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true });
};
