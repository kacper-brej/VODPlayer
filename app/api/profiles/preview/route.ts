import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog/catalog";
import { getNewestSeries } from "@/lib/catalog/catalogRows";
import { PROFILE_COOKIE } from "@/lib/core/vodConfig";
import { resolvePreviewSource, type PreviewSource } from "@/lib/player/videoAccess";
import { isProfileOwnedByUser } from "@/lib/profiles/profileRepository";
import { getLatestResume } from "@/lib/progress/continueWatching";
import { getProfileSettingsRow } from "@/lib/settings/settingsRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (previewSource: PreviewSource | null, status = 200) => Response.json(
    { previewSource },
    { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
);

export const GET = async (request: Request) => {
    const user = await getSessionUser();
    if (!user) return respond(null, 401);

    const profileId = Number(new URL(request.url).searchParams.get("profileId"));
    if (!Number.isSafeInteger(profileId) || profileId <= 0) return respond(null, 400);
    if ((await cookies()).get(PROFILE_COOKIE)?.value !== String(profileId)) return respond(null, 409);

    try {
        if (!await isProfileOwnedByUser(profileId, user.id)) return respond(null, 403);
        const settings = await getProfileSettingsRow(profileId);
        if (settings && (!settings.autoPreviewsEnabled || settings.reduceData)) return respond(null);
        if (request.signal.aborted) return respond(null);

        const [catalogResult, resumeResult] = await Promise.all([getCatalog(false), getLatestResume()]);
        if (catalogResult.kind !== "success" || request.signal.aborted) return respond(null);

        const resume = resumeResult.kind === "success" ? resumeResult.data : null;
        const series = (resume ? catalogResult.data.find((item) => item.key === resume.seriesKey) : null)
            ?? getNewestSeries(catalogResult.data).find((item) => item.episodes.length > 0)
            ?? catalogResult.data.find((item) => item.episodes.length > 0)
            ?? null;
        if (!series) return respond(null);

        const episode = series.episodes.find((item) => item.key === resume?.episodeKey)
            ?? series.episodes[0]
            ?? null;
        return respond(episode ? resolvePreviewSource(series.key, episode, resume?.positionSeconds ?? null) : null);
    } catch {
        return respond(null, 500);
    }
};
