import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { getMediaStatus } from "@/lib/admin/mediaStatusService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const status = await getMediaStatus();
    return NextResponse.json(status);
};
