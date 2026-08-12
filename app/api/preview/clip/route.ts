import { getSessionUser } from "@/lib/auth/session";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { buildGrantedPreviewClip } from "@/lib/player/previewService";
import { parsePreviewGrant, verifyPreviewGrant } from "@/lib/player/previewSigning";
import { canStreamSeries } from "@/lib/access/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (status: number, message: string) =>
    Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

export const GET = async (request: Request) => {
    const user = await getSessionUser();
    if (!user) return fail(401, "Brak autoryzacji.");
    const parsed = parsePreviewGrant(new URL(request.url).searchParams);
    if (!parsed || parsed.grant.kind !== "clip") return fail(400, "Nieprawidlowy grant podgladu.");
    if (!verifyPreviewGrant(parsed.grant, parsed.signature)) return fail(403, "Nieprawidlowy podpis.");
    if (parsed.grant.expiresAt < Math.floor(Date.now() / 1000)) return fail(410, "Grant wygasl.");
    let profileId: number;
    try {
        profileId = await resolveOwnedProfileId(user.id, user.username);
    } catch {
        return fail(500, "Blad serwera.");
    }
    if (profileId !== parsed.grant.profileId) return fail(403, "Grant nalezy do innego profilu.");

    try {
        if (!await canStreamSeries(user, parsed.grant.seriesKey)) return fail(403, "Brak dostępu do materiału.");
    } catch {
        return fail(500, "Błąd serwera.");
    }

    const result = await buildGrantedPreviewClip(parsed.grant);
    if (!result.ok) {
        if (result.code === "not_found") return fail(404, "Klip niedostepny.");
        if (result.code === "storage") return fail(502, "Magazyn niedostepny.");
        return fail(500, "Blad serwera.");
    }
    return new Response(null, {
        status: 302,
        headers: { Location: result.url, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
};
