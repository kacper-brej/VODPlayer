import { preloadHeroPreview, shouldPreloadHeroPreview } from "@/lib/player/preloadHeroPreview";
import type { PreviewSource } from "@/lib/player/videoAccess";

const PREVIEW_LOOKUP_TIMEOUT_MS = 4_000;

const isPreviewSource = (value: unknown): value is PreviewSource => {
    if (typeof value !== "object" || value === null) return false;
    const source = value as Partial<PreviewSource>;
    return source.kind === "session" && source.startSeconds === 0
        && typeof source.src === "string" && source.src.startsWith("/api/preview?");
};

export const preloadSelectedProfilePreview = async (profileId: number): Promise<void> => {
    if (!Number.isSafeInteger(profileId) || profileId <= 0 || !shouldPreloadHeroPreview()) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PREVIEW_LOOKUP_TIMEOUT_MS);
    let source: PreviewSource | null = null;
    try {
        const response = await fetch(`/api/profiles/preview?profileId=${profileId}`, {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok) return;
        const value: unknown = await response.json();
        if (typeof value === "object" && value !== null && "previewSource" in value && isPreviewSource(value.previewSource)) {
            source = value.previewSource;
        }
    } catch {
        controller.abort();
    } finally {
        clearTimeout(timeout);
    }
    if (source && !controller.signal.aborted && shouldPreloadHeroPreview()) await preloadHeroPreview(source);
};
