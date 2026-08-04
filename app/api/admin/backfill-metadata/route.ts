import { NextRequest, NextResponse } from "next/server";
import { hasActiveSession } from "@/lib/verifySession";
import backfillCatalogMetadataAction from "@/lib/backfillCatalogMetadataAction";

export const GET = async (request: NextRequest) => {
    if (!(await hasActiveSession(request))) {
        return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    }

    const result = await backfillCatalogMetadataAction();

    if (result.kind === "error") {
        return NextResponse.json({ error: result.reason }, { status: 500 });
    }

    return NextResponse.json({ items: result.data });
};
