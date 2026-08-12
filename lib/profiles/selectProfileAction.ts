"use server";
import { cookies } from "next/headers";
import { PROFILE_COOKIE } from "@/lib/core/vodConfig";
import { getProfiles } from "@/lib/profiles/profiles";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog/catalog";
import { getNewestSeries } from "@/lib/catalog/catalogRows";
import { getLatestResume } from "@/lib/progress/continueWatching";
import { resolvePreviewSource, type PreviewSource } from "@/lib/player/videoAccess";

const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type SelectProfileResult =
    | { success: true; previewSource: PreviewSource | null }
    | { success: false; error: "unauthorized" | "not_found" | "backend" };

const resolveSelectedProfilePreview = async (): Promise<PreviewSource | null> => {
    const [catalogResult, resumeResult] = await Promise.all([
        getCatalog(),
        getLatestResume(),
    ]);
    if (catalogResult.kind !== "success") return null;

    const resume = resumeResult.kind === "success" ? resumeResult.data : null;
    const series = (resume
        ? catalogResult.data.find((item) => item.key === resume.seriesKey)
        : null)
        ?? getNewestSeries(catalogResult.data).find((item) => item.episodes.length > 0)
        ?? catalogResult.data.find((item) => item.episodes.length > 0)
        ?? null;
    if (!series) return null;

    const episode = series.episodes.find((item) => item.key === resume?.episodeKey)
        ?? series.episodes[0]
        ?? null;
    if (!episode) return null;

    return resolvePreviewSource(series.key, episode, resume?.positionSeconds ?? null);
};

const selectProfileAction = async (profileId: number): Promise<SelectProfileResult> => {
    if (!await getSessionUser()) return { success: false, error: "unauthorized" };
    if (!Number.isSafeInteger(profileId) || profileId <= 0) return { success: false, error: "not_found" };
    const result = await getProfiles();

    if (result.kind === "error") {
        return { success: false, error: result.reason === "unauthorized" ? "unauthorized" : "backend" };
    }

    if (!result.data.some((profile) => profile.id === profileId)) {
        return { success: false, error: "not_found" };
    }

    (await cookies()).set(PROFILE_COOKIE, String(profileId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: PROFILE_COOKIE_MAX_AGE,
    });
    return {
        success: true,
        previewSource: await resolveSelectedProfilePreview(),
    };
};

export default selectProfileAction;
