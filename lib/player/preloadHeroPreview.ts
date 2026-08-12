import type { PreviewSource } from "@/lib/player/videoAccess";
import { isPreviewSessionSource, type PreviewSessionSource } from "@/lib/player/previewTypes";

const PRELOAD_TIMEOUT_MS = 4_000;

const fetchBody = async (url: string, init?: RequestInit): Promise<string> => {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...init,
    });
    if (!response.ok) throw new Error(`Preview preload failed: ${response.status}`);
    return response.text();
};

const mediaUrlsAtPosition = (playlist: string, startSeconds: number): string[] => {
    const urls: string[] = [];
    const mapMatch = playlist.match(/#EXT-X-MAP:URI="([^"]+)"/u);
    if (mapMatch?.[1]) urls.push(mapMatch[1]);

    const lines = playlist.split(/\r?\n/u);
    let elapsed = 0;

    for (let index = 0; index < lines.length; index += 1) {
        const durationMatch = lines[index]?.match(/^#EXTINF:([\d.]+)/u);
        if (!durationMatch) continue;

        const duration = Number(durationMatch[1]);
        const segmentUrl = lines.slice(index + 1).find((line) => line.length > 0 && !line.startsWith("#"));
        if (!segmentUrl) continue;

        if (startSeconds < elapsed + duration || !Number.isFinite(duration)) {
            urls.push(segmentUrl);
            break;
        }
        elapsed += duration;
    }

    return [...new Set(urls)];
};

const preloadHls = async (source: PreviewSessionSource): Promise<void> => {
    const playlist = await fetchBody(source.src, { cache: "no-store" });
    const mediaUrls = mediaUrlsAtPosition(playlist, source.mediaOffsetSeconds);

    await Promise.all(mediaUrls.map(async (url) => {
        const response = await fetch(url, { cache: "force-cache" });
        if (response.ok) await response.arrayBuffer();
    }));
};

const preloadSource = async (intent: PreviewSource): Promise<void> => {
    const response = await fetch(intent.src, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return;
    const value: unknown = await response.json();
    if (!isPreviewSessionSource(value)) return;

    if (value.type === "hls") {
        await preloadHls(value);
        return;
    }

    const mediaResponse = await fetch(value.src, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Range: "bytes=0-262143" },
    });
    if (mediaResponse.ok) await mediaResponse.arrayBuffer();
};

export const preloadHeroPreview = async (source: PreviewSource | null): Promise<void> => {
    if (!source) return;

    await Promise.race([
        preloadSource(source).catch(() => {}),
        new Promise<void>((resolve) => window.setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
    ]);
};
