import { NextResponse } from "next/server";
import type { PartyLifecycleFailure } from "@/lib/party/partyLifecycleService";
import { readTextBodyWithLimit } from "@/lib/http/requestBody";

export const readPartyObjectBody = async (
    request: Request,
    maxBytes = 4096,
): Promise<Record<string, unknown> | null> => {
    if (request.body === null) return {};
    const raw = await readTextBodyWithLimit(request, maxBytes).catch(() => null);
    if (raw === null) return null;
    if (raw.trim() === "") return {};

    try {
        const payload: unknown = JSON.parse(raw);
        return payload !== null && typeof payload === "object" && !Array.isArray(payload)
            ? payload as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
};

export const partyFailureResponse = (code: PartyLifecycleFailure): NextResponse => {
    if (code === "invalid") {
        return NextResponse.json({ error: "Nieprawidłowy serial lub odcinek." }, { status: 422 });
    }
    if (code === "forbidden") {
        return NextResponse.json({ error: "Brak dostępu do materiału." }, { status: 403 });
    }
    return NextResponse.json({ error: "Pokój jest niedostępny." }, { status: 403 });
};

export const partyServerError = (): NextResponse =>
    NextResponse.json({ error: "Nie udało się obsłużyć pokoju." }, { status: 500 });

export const noStoreJson = (body: unknown, status = 200): NextResponse =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
