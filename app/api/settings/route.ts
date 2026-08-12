import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { getSettings, updateSettings, type UpdateSettingsInput } from "@/lib/settings/settingsService";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { consumeWriteRateLimit } from "@/lib/http/writeRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const settings = await getSettings(user.id, user.username);
    return NextResponse.json({ settings });
};

export const PATCH = async (request: Request) => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;
    if (await consumeWriteRateLimit(user.id, "settings", 30, 900)) return NextResponse.json({ error: "Zbyt wiele zmian." }, { status: 429 });

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    }

    const ALLOWED_KEYS = new Set([
        "autoplayNext",
        "autoPreviewsEnabled",
        "skipIntroPrompt",
        "preferredSubtitleLang",
        "preferredAudioLang",
        "defaultVolume",
        "reduceData",
    ]);
    const unknownKey = Object.keys(payload).find((key) => !ALLOWED_KEYS.has(key));
    if (unknownKey) {
        return NextResponse.json({ error: `Nieznane pole: ${unknownKey}` }, { status: 422 });
    }

    const result = await updateSettings(user.id, user.username, payload as UpdateSettingsInput);
    if (!result.ok) {
        const status = result.code === "server" ? 500 : 422;
        const message = result.code === "server" ? "Nie udało się zapisać ustawień." : "Nieprawidłowe dane ustawień.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ settings: result.settings });
};
