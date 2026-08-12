import { NextResponse } from "next/server";
import { authenticateMediaRegistryRequest } from "@/lib/media/mediaRegistryAuth";
import { insertVerificationRun } from "@/lib/media/mediaRegistryRepository";
import { readTextBodyWithLimit, RequestBodyTooLargeError } from "@/lib/http/requestBody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4 * 1024;

export const POST = async (request: Request) => {
    try {
        const rawBody = await readTextBodyWithLimit(request, MAX_BODY_BYTES);
        if (!await authenticateMediaRegistryRequest(request, rawBody)) {
            return NextResponse.json({ error: "Nieprawidłowy albo wykorzystany podpis żądania." }, { status: 401 });
        }
        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        if (!Number.isSafeInteger(payload.checkedCount) || (payload.checkedCount as number) < 0
            || !Number.isSafeInteger(payload.failedCount) || (payload.failedCount as number) < 0) {
            return NextResponse.json({ error: "Nieprawidłowe pola checkedCount/failedCount." }, { status: 422 });
        }
        await insertVerificationRun(payload.checkedCount as number, payload.failedCount as number);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
            return NextResponse.json({ error: "Ciało żądania jest zbyt duże." }, { status: 413 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Nieprawidłowe ciało żądania." }, { status: 422 });
        }
        console.error("POST /api/media/verify-log failed", error);
        return NextResponse.json({ error: "Nie udało się zapisać przebiegu weryfikacji." }, { status: 500 });
    }
};
