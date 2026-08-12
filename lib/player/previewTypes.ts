import type { PreviewDecisionReason } from "@/lib/player/previewPolicy";

export interface PreviewSessionSource {
    mode: "preview";
    type: "mp4" | "hls";
    src: string;
    expiresAt: number;
    sourceTimelineStartSeconds: number;
    mediaOffsetSeconds: number;
    durationSeconds: number;
    reason: PreviewDecisionReason;
}

export const isPreviewSessionSource = (value: unknown): value is PreviewSessionSource => {
    if (!value || typeof value !== "object") return false;
    const source = value as Partial<PreviewSessionSource>;
    return source.mode === "preview"
        && (source.type === "mp4" || source.type === "hls")
        && typeof source.src === "string" && source.src.startsWith("/api/preview/")
        && typeof source.expiresAt === "number" && Number.isFinite(source.expiresAt)
        && typeof source.sourceTimelineStartSeconds === "number" && Number.isFinite(source.sourceTimelineStartSeconds)
        && typeof source.mediaOffsetSeconds === "number" && Number.isFinite(source.mediaOffsetSeconds)
        && typeof source.durationSeconds === "number" && source.durationSeconds > 0
        && ["resume", "editorial", "default", "completed-fallback"].includes(source.reason ?? "");
};
