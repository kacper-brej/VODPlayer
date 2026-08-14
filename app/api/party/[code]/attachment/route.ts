import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { parseStringParam } from "@/lib/http/routeParams";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";
import { PARTY_ATTACHMENT_MAX_BYTES } from "@/lib/party/partyAttachment";
import {
    linkPartyAttachment,
    uploadPartyAttachment,
    type PartyAttachmentFailure,
} from "@/lib/party/partyAttachmentService";
import { noStoreJson, partyServerError } from "../../partyHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failureResponse = (code: PartyAttachmentFailure) => {
    if (code === "too-large") {
        return NextResponse.json({ error: "Obraz jest za duży. Maksimum to 4 MB." }, { status: 413 });
    }
    if (code === "invalid") {
        return NextResponse.json({ error: "Przyjmujemy tylko pliki JPG, PNG, WEBP i GIF." }, { status: 422 });
    }
    if (code === "unconfigured") {
        return NextResponse.json(
            { error: "Wysyłanie obrazów nie jest skonfigurowane: brakuje B2_PARTY_WRITE_KEY_ID." },
            { status: 503 },
        );
    }
    if (code === "storage") {
        return NextResponse.json(
            { error: "Magazyn odrzucił zapis. Sprawdź, czy klucz B2 obejmuje prefiks party-chat/." },
            { status: 502 },
        );
    }
    return NextResponse.json({ error: "Pokój jest niedostępny." }, { status: 403 });
};

export const POST = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    if (await consumeWriteRateLimit(gate.user.id, "party-attachment", 20, 300)) {
        return NextResponse.json({ error: "Zbyt wiele wysłanych obrazów. Zwolnij tempo." }, { status: 429 });
    }

    const code = parseStringParam((await context.params).code, 16);
    if (code === null) return failureResponse("invalid");

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > PARTY_ATTACHMENT_MAX_BYTES) {
        return failureResponse("too-large");
    }

    try {
        const body = new Uint8Array(await request.arrayBuffer());
        const result = await uploadPartyAttachment(gate.user, code, body);
        if (!result.ok) return failureResponse(result.code);
        return noStoreJson({ attachment: result.storageKey, kind: result.kind });
    } catch {
        return partyServerError();
    }
};

export const GET = async (request: Request, context: { params: Promise<{ code: string }> }) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;

    const code = parseStringParam((await context.params).code, 16);
    const storageKey = new URL(request.url).searchParams.get("key") ?? "";
    if (code === null || storageKey === "") return failureResponse("invalid");

    try {
        const result = await linkPartyAttachment(gate.user, code, storageKey);
        if (!result.ok) return failureResponse(result.code);
        return new Response(null, {
            status: 302,
            headers: {
                Location: result.url,
                "Cache-Control": "private, max-age=300",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return partyServerError();
    }
};
