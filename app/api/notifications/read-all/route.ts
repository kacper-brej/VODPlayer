import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { markAllNotificationsRead } from "@/lib/notifications/notificationService";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async () => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "notifications", 120, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const result = await markAllNotificationsRead(user.id, user.username);
    if (!result.ok) return NextResponse.json({ error: "Nie udało się oznaczyć powiadomień jako przeczytane." }, { status: 500 });

    return NextResponse.json({ success: true });
};
