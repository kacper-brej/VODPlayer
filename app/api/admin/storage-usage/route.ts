import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { captureStorageUsageSnapshot, getStorageUsage } from "@/lib/admin/storageUsageService";
import { rejectCrossSiteMutation } from "@/lib/http/requestSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const usage = await getStorageUsage();
    return NextResponse.json(usage);
};

export const POST = async (request: Request) => {
    const rejected = rejectCrossSiteMutation(request);
    if (rejected) return rejected;
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;
    await captureStorageUsageSnapshot();
    return NextResponse.json({ success: true });
};
