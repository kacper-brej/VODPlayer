import type { EpisodeChapter } from "@/lib/core/contracts";

export const DEMO_INTRO_END_SECONDS = 90;
export const DEMO_OUTRO_LEAD_SECONDS = 60;

export const demoChapters = (durationSeconds: number | null): EpisodeChapter[] => {
    if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];

    const chapters: EpisodeChapter[] = [
        { type: "intro", startSeconds: 0, endSeconds: DEMO_INTRO_END_SECONDS },
    ];

    if (durationSeconds > DEMO_OUTRO_LEAD_SECONDS) {
        chapters.push({
            type: "outro",
            startSeconds: Math.round(durationSeconds - DEMO_OUTRO_LEAD_SECONDS),
            endSeconds: Math.round(durationSeconds),
        });
    }

    return chapters;
};
