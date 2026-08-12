import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { getWatchlist, addToWatchlist } from "@/lib/watchlist/watchlistService";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const items = await getWatchlist(user.id, user.username);
    return NextResponse.json({ items });
};

export const POST = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "watchlist", 60, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    const series = payload && typeof payload === "object" && "series" in payload && typeof payload.series === "string"
        ? payload.series
        : "";

    const result = await addToWatchlist(user.id, user.username, series);
    if (!result.ok) {
        return NextResponse.json({ error: "Brak identyfikatora serialu." }, { status: result.code === "server" ? 500 : 422 });
    }

    revalidatePath("/");
    revalidatePath("/favourites");

    return NextResponse.json({ success: true, seriesKey: result.seriesKey }, { status: 201 });
};
