import { NextRequest, NextResponse } from "next/server";
import { sessionHeaders, VOD_ORIGIN } from "@/lib/vodConfig";
import { hasActiveSession } from "@/lib/verifySession";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST = async (request: NextRequest) => {
    if (!(await hasActiveSession(request))) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const headers = await sessionHeaders();
    if (!headers) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    const seriesKey = formData.get("seriesKey");
    const kind = formData.get("kind");

    if (!(file instanceof File) || typeof seriesKey !== "string" || typeof kind !== "string") {
        return NextResponse.json({ error: "Invalid upload data." }, { status: 422 });
    }

    if (file.size < 1 || file.size > MAX_BYTES || !ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: "Choose a JPG, PNG or WebP file up to 8 MB." }, { status: 422 });
    }

    const upstream = new FormData();
    upstream.set("seriesKey", seriesKey);
    upstream.set("kind", kind);
    upstream.set("file", file, file.name);

    try {
        const response = await fetch(`${VOD_ORIGIN}/artwork-upload.php`, {
            method: "POST",
            headers,
            body: upstream,
            cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => ({ error: "Invalid server response." }));
        return NextResponse.json(payload, { status: response.status });
    } catch {
        return NextResponse.json({ error: "The media server is unavailable." }, { status: 503 });
    }
};
