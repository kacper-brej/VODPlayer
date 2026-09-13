import getSeriesDetailsAction from "@/lib/catalog/getSeriesDetailsAction";
import { dataFailure, type DataResult } from "@/lib/core/dataResult";
import { getSessionUser } from "@/lib/auth/session";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resultResponse = (result: DataResult<unknown>) => {
    const status = result.kind === "error"
        ? result.status ?? (result.reason === "unauthorized" ? 401 : result.reason === "forbidden" ? 403 : 500)
        : 200;
    return Response.json(result, {
        status,
        headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
};

const respond = async (request: Request, enrichMetadata: boolean) => {
    const rawId = new URL(request.url).searchParams.get("id") ?? "";
    const id = Number(rawId);
    if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id <= 0) return resultResponse(dataFailure("invalid_response", 400));

    try {
        if (enrichMetadata) {
            const user = await getSessionUser();
            if (!user) return resultResponse(dataFailure("unauthorized", 401));
            if (await consumeWriteRateLimit(user.id, "series_metadata", 60, 900)) return resultResponse(dataFailure("server", 429));
        }
        return resultResponse(await getSeriesDetailsAction(id, enrichMetadata));
    } catch (error) {
        console.error("Series details request failed", error);
        return resultResponse(dataFailure("server", 500));
    }
};

export const GET = (request: Request) => respond(request, false);
export const POST = (request: Request) => respond(request, true);
