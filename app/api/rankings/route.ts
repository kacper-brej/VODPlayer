import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { getWeeklyRanking } from "@/lib/rankings/rankingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") ?? "week";
    if (period !== "week") {
        return NextResponse.json({ error: "Nieobsługiwany okres rankingu." }, { status: 422 });
    }

    const items = await getWeeklyRanking();
    return NextResponse.json({ period, items });
};
