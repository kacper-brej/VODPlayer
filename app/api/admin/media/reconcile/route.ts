import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { reconcileMediaDryRun } from "@/lib/admin/mediaReconcilerService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    try {
        return NextResponse.json(await reconcileMediaDryRun(), {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("GET /api/admin/media/reconcile failed", error);
        return NextResponse.json({ error: "Nie udało się wykonać dry-run reconciliacji." }, { status: 500 });
    }
};
