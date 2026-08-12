import { NextResponse } from "next/server";
import { getMediaStatus } from "@/lib/admin/mediaStatusService";
import { authenticateMediaRegistryRequest } from "@/lib/media/mediaRegistryAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
    if (!await authenticateMediaRegistryRequest(request, "")) {
        return NextResponse.json({ error: "Nieprawidłowy podpis żądania." }, { status: 401 });
    }
    try {
        return NextResponse.json(await getMediaStatus());
    } catch (error) {
        console.error("GET /api/media/status failed", error);
        return NextResponse.json({ error: "Błąd serwera." }, { status: 500 });
    }
};
