import { NextResponse } from "next/server";
import { requireAdminRoute, requireSessionRoute } from "@/lib/http/routeAuth";
import { readJsonBodyWithLimit, RequestBodyTooLargeError } from "@/lib/http/requestBody";
import { rejectCrossSiteMutation } from "@/lib/http/requestSecurity";
import { parsePerformanceBatch } from "@/lib/performance/contracts";
import { getPerformanceStore } from "@/lib/performance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export const POST = async (request: Request) => {
    const rejected = rejectCrossSiteMutation(request);
    if (rejected) return rejected;
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const store = getPerformanceStore();
    if (!store.acceptReporter(gate.user.id)) return new NextResponse(null, { status: 429, headers });
    try {
        const samples = parsePerformanceBatch(await readJsonBodyWithLimit(request, 12_000));
        if (!samples) return new NextResponse(null, { status: 400, headers });
        store.record(samples);
        if (process.env.PERFORMANCE_LOGS === "1") console.info(JSON.stringify({ event: "performance", samples }));
        return new NextResponse(null, { status: 204, headers });
    } catch (error) {
        if (error instanceof RequestBodyTooLargeError) return new NextResponse(null, { status: 413, headers });
        if (error instanceof SyntaxError) return new NextResponse(null, { status: 400, headers });
        return new NextResponse(null, { status: 503, headers });
    }
};

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;
    return NextResponse.json(getPerformanceStore().snapshot(), { headers });
};
