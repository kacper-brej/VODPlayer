import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { removeFromWatchlist } from "@/lib/watchlist/watchlistService";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = async (_request: Request, context: { params: Promise<{ seriesKey: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "watchlist", 60, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const { seriesKey } = await context.params;
    const result = await removeFromWatchlist(user.id, user.username, decodeURIComponent(seriesKey));

    if (!result.ok) {
        return NextResponse.json({ error: "Brak identyfikatora serialu." }, { status: result.code === "server" ? 500 : 422 });
    }

    revalidatePath("/");
    revalidatePath("/favourites");

    return NextResponse.json({ success: true });
};
