import { getSessionUser } from "@/lib/auth/session";
import { buildManifest, HLS_MANIFEST_PATH } from "@/lib/player/hlsService";
import { verifyHlsManifestSignature, isHlsVariant } from "@/lib/player/hlsSigning";
import { canStreamSeries } from "@/lib/access/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });

export const GET = async (request: Request) => {
    const user = await getSessionUser();
    if (!user) return fail(401, "Brak autoryzacji.");

    const { searchParams } = new URL(request.url);
    const assetIdRaw = searchParams.get("a") ?? "";
    const assetVersionRaw = searchParams.get("ver") ?? "";
    const seriesKey = searchParams.get("s") ?? "";
    const episodeKey = searchParams.get("e") ?? "";
    const variant = searchParams.get("v") ?? "";
    const expiresRaw = searchParams.get("exp") ?? "";
    const signature = searchParams.get("sig") ?? "";

    if (!seriesKey || !episodeKey) return fail(400, "Nieprawidłowy adres materiału.");
    if (!isHlsVariant(variant)) return fail(400, "Nieprawidłowy wariant.");
    if (!/^\d+$/.test(expiresRaw)) return fail(400, "Nieprawidłowy adres materiału.");

    if (!/^\d+$/.test(assetIdRaw) || !/^\d+$/.test(assetVersionRaw)) {
        return fail(400, "Nieprawidlowy adres materialu.");
    }

    const assetId = Number(assetIdRaw);
    const assetVersion = Number(assetVersionRaw);
    const expiresAt = Number(expiresRaw);
    if (!Number.isSafeInteger(assetId) || assetId <= 0 || !Number.isSafeInteger(assetVersion) || assetVersion < 0) {
        return fail(400, "Nieprawidlowy adres materialu.");
    }

    if (!verifyHlsManifestSignature(assetId, assetVersion, seriesKey, episodeKey, variant, expiresAt, signature)) {
        return fail(403, "Nieprawidłowy podpis adresu.");
    }

    if (expiresAt < Math.floor(Date.now() / 1000)) return fail(410, "Adres materiału wygasł.");

    try {
        if (!await canStreamSeries(user, seriesKey)) return fail(403, "Brak dostępu do materiału.");
    } catch {
        return fail(500, "Błąd serwera.");
    }

    const result = await buildManifest(
        assetId, assetVersion, seriesKey, episodeKey, variant, expiresAt, HLS_MANIFEST_PATH,
    );

    if (!result.ok) {
        if (result.code === "not_found") return fail(404, "Materiał niedostępny.");
        if (result.code === "variant_not_found") return fail(404, "Wariant niedostępny.");
        if (result.code === "storage") return fail(502, "Nie udało się pobrać playlisty z B2.");
        return fail(500, "Błąd serwera.");
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
