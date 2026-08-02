import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/verifySession";
import backfillEpisodeStillsAction from "@/lib/episodeStillsBackfillAction";

export const GET = async (request: NextRequest) => {
    if (!(await hasValidSession(request))) {
        return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const result = await backfillEpisodeStillsAction();

    if (result.kind === "error") {
        return NextResponse.json({ error: result.reason }, { status: 500 });
    }

    return NextResponse.json({ items: result.data });
};
