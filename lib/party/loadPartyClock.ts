import { estimateClockOffset, type ClockEstimate, type ClockSample } from "@/lib/party/clockSync";

const SAMPLE_COUNT = 7;
const SAMPLE_CONCURRENCY = 2;
const SAMPLE_TIMEOUT_MS = 5_000;

export const loadPartyClock = async (signal: AbortSignal): Promise<ClockEstimate | null> => {
    const samples: ClockSample[] = [];
    let nextSample = 0;

    const worker = async () => {
        while (!signal.aborted && nextSample < SAMPLE_COUNT) {
            nextSample += 1;
            const controller = new AbortController();
            const onAbort = () => controller.abort();
            signal.addEventListener("abort", onAbort, { once: true });
            const timer = setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS);
            const clientSentAtMs = Date.now();
            try {
                const response = await fetch("/api/party/time", { cache: "no-store", signal: controller.signal });
                const clientReceivedAtMs = Date.now();
                if (!response.ok || controller.signal.aborted) continue;
                const value: unknown = await response.json();
                if (controller.signal.aborted || !value || typeof value !== "object" || !("serverNowMs" in value)) continue;
                const serverNowMs = value.serverNowMs;
                if (typeof serverNowMs !== "number" || !Number.isFinite(serverNowMs)) continue;
                samples.push({ clientSentAtMs, serverNowMs, clientReceivedAtMs });
            } catch {
            } finally {
                clearTimeout(timer);
                signal.removeEventListener("abort", onAbort);
            }
        }
    };

    await Promise.all(Array.from({ length: SAMPLE_CONCURRENCY }, worker));
    return signal.aborted ? null : estimateClockOffset(samples);
};
