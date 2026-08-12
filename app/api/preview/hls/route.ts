import { getSessionUser } from "@/lib/auth/session";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { buildShortPreviewManifest } from "@/lib/player/previewHlsService";
import { findGrantedPreviewAsset } from "@/lib/player/previewRepository";
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
    if (!parsed || parsed.grant.kind !== "hls") return fail(400, "Nieprawidlowy grant podgladu.");
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

    let asset;
    try {
        asset = await findGrantedPreviewAsset(
            parsed.grant.assetId,
            parsed.grant.assetVersion,
            parsed.grant.seriesKey,
            parsed.grant.episodeKey,
        );
    } catch {
        return fail(500, "Blad serwera.");
    }
    if (!asset) return fail(404, "Material niedostepny.");
    const result = await buildShortPreviewManifest(
        asset,
        parsed.grant.variant,
        parsed.grant.firstSegment,
        parsed.grant.lastSegment,
    );
    if (!result.ok) {
        if (result.code === "not_found" || result.code === "invalid") return fail(404, "Zakres niedostepny.");
        return fail(502, "Magazyn niedostepny.");
    }
    return new Response(result.body, {
        status: 200,
        headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
};
