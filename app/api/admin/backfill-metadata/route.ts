import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import backfillCatalogMetadataAction from "@/lib/admin/backfillCatalogMetadataAction";
import { AdminJobAlreadyRunningError, withAdminJobLock } from "@/lib/admin/jobLock";
import { rejectCrossSiteMutation } from "@/lib/http/requestSecurity";

export const POST = async (request: Request) => {
    const rejected = rejectCrossSiteMutation(request);
    if (rejected) return rejected;
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    let result;
    try { result = await withAdminJobLock("backfill-metadata", backfillCatalogMetadataAction); }
    catch (error) {
        if (error instanceof AdminJobAlreadyRunningError) return NextResponse.json({ error: "Zadanie już trwa." }, { status: 409 });
        throw error;
    }

    if (result.kind === "error") {
        return NextResponse.json({ error: result.reason }, { status: 500 });
    }

    return NextResponse.json({ items: result.data });
};
