import { MAX_BATCH_SIZE, pageGroup, type PerformanceSample } from "./contracts";

const queue = new Map<string, PerformanceSample>();
let enabled: boolean | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let initialPage: PerformanceSample["page"] | undefined;
let device: PerformanceSample["device"] | undefined;
let watchIntent: number | undefined;

export const performanceSamplingEnabled = () => {
    if (enabled !== undefined) return enabled;
    const raw = Number(process.env.NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE ?? "0.1");
    const rate = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.1;
    enabled = typeof window !== "undefined" && Math.random() < rate;
    return enabled;
};

export const capturePerformanceContext = () => {
    const navigation = performance.getEntriesByType("navigation")[0];
    initialPage ??= pageGroup(navigation ? new URL(navigation.name, window.location.href).pathname : window.location.pathname);
    device ??= window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
};

export const flushPerformanceSamples = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (queue.size === 0) return;
    const body = JSON.stringify([...queue.values()]);
    queue.clear();
    try {
        if (navigator.sendBeacon?.("/api/performance", new Blob([body], { type: "application/json" }))) return;
        void fetch("/api/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "same-origin", keepalive: true }).catch(() => undefined);
    } catch {}
};

export const reportPerformanceSample = (sample: Pick<PerformanceSample, "id" | "name" | "value"> & { delivery?: "file" | "hls" }) => {
    if (!performanceSamplingEnabled() || !Number.isFinite(sample.value) || sample.value < 0) return;
    if (sample.value > (sample.name === "CLS" ? 100 : sample.name === "PLAYER_ERROR" ? 1 : 600_000)) return;
    capturePerformanceContext();
    const page = sample.delivery ? "watch" : initialPage!;
    const entry: PerformanceSample = { ...sample, page, device: device!, delivery: sample.delivery ?? "page" };
    const key = `${entry.name}:${entry.id}`;
    if (!queue.has(key) && queue.size >= MAX_BATCH_SIZE) flushPerformanceSamples();
    queue.set(key, entry);
    if (!timer) timer = setTimeout(flushPerformanceSamples, 15_000);
};

export const captureWatchIntent = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin && url.pathname === "/watch") watchIntent = performance.now();
};

export const consumeWatchIntent = () => {
    const intent = watchIntent;
    watchIntent = undefined;
    return intent !== undefined && performance.now() - intent < 30_000 ? intent : undefined;
};
