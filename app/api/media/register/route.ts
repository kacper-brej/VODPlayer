import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import { authenticateMediaRegistryRequest } from "@/lib/media/mediaRegistryAuth";
import { readTextBodyWithLimit, RequestBodyTooLargeError } from "@/lib/http/requestBody";
import { MediaRegistryValidationError, parseMediaRegistration, saveMediaRegistration } from "@/lib/media/mediaRegistryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1024;

export const POST = async (request: Request) => {
    try {
        const rawBody = await readTextBodyWithLimit(request, MAX_BODY_BYTES);
        if (!await authenticateMediaRegistryRequest(request, rawBody)) {
            return NextResponse.json({ error: "Nieprawidłowy albo wykorzystany podpis żądania." }, { status: 401 });
        }
        const input = parseMediaRegistration(JSON.parse(rawBody) as unknown);
        const result = await saveMediaRegistration(input);
        if (result.status === "missing") {
            return NextResponse.json({ error: "Brak rejestracji startowej dla tego odcinka." }, { status: 404 });
        }
        if (result.status === "conflict") {
            return NextResponse.json({ error: "Asset jest usuwany albo został usunięty." }, { status: 409 });
        }
        if (result.status === "ready" || result.status === "already_ready") revalidateTag(CATALOG_TAG, "max");
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        if (error instanceof RequestBodyTooLargeError) {
            return NextResponse.json({ error: "Ciało żądania jest zbyt duże." }, { status: 413 });
        }
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
        }
        if (error instanceof MediaRegistryValidationError) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        console.error("POST /api/media/register failed", error);
        return NextResponse.json({ error: "Błąd serwera." }, { status: 500 });
    }
};
