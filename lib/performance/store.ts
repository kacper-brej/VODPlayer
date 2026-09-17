import "server-only";
import { randomUUID } from "node:crypto";
import type { PerformanceSample } from "./contracts";

const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = 512;
type StoredSample = { value: number; at: number };

export const createPerformanceStore = (now = Date.now) => {
    const buckets = new Map<string, { labels: Omit<PerformanceSample, "id" | "value">; samples: Map<string, StoredSample> }>();
    const reporters = new Map<number, { count: number; until: number }>();
    const instance = randomUUID();
    const startedAt = now();
    const prune = (samples: Map<string, StoredSample>) => {
        const cutoff = now() - RETENTION_MS;
        for (const [id, sample] of samples) if (sample.at < cutoff) samples.delete(id);
    };
    return {
        acceptReporter(userId: number) {
            const current = reporters.get(userId);
            if (current && current.until > now()) return ++current.count <= 12;
            for (const [id, entry] of reporters) if (entry.until <= now()) reporters.delete(id);
            if (reporters.size >= 10_000) return false;
            reporters.set(userId, { count: 1, until: now() + 60_000 });
            return true;
        },
        record(samples: PerformanceSample[]) {
            for (const sample of samples) {
                const { name, page, device, delivery } = sample;
                const key = `${page}:${device}:${delivery}:${name}`;
                let bucket = buckets.get(key);
                if (!bucket) {
                    bucket = { labels: { name, page, device, delivery }, samples: new Map() };
                    buckets.set(key, bucket);
                }
                prune(bucket.samples);
                bucket.samples.delete(sample.id);
                bucket.samples.set(sample.id, { value: sample.value, at: now() });
                if (bucket.samples.size > MAX_SAMPLES) bucket.samples.delete(bucket.samples.keys().next().value!);
            }
        },
        snapshot() {
            const rows = [];
            for (const [key, bucket] of buckets) {
                prune(bucket.samples);
                if (bucket.samples.size === 0) { buckets.delete(key); continue; }
                const values = [...bucket.samples.values()].map((sample) => sample.value).sort((a, b) => a - b);
                const percentile = (fraction: number) => values[Math.ceil(values.length * fraction) - 1];
                rows.push({ ...bucket.labels, count: values.length, p50: percentile(0.5), p75: percentile(0.75), p95: percentile(0.95), max: values[values.length - 1] });
            }
            return { instance, startedAt, capturedAt: now(), retentionHours: 24, sampleLimit: MAX_SAMPLES, rows };
        },
    };
};

declare global {
    var __nocturnaPerformanceStore: ReturnType<typeof createPerformanceStore> | undefined;
}

export const getPerformanceStore = () => globalThis.__nocturnaPerformanceStore ??= createPerformanceStore();
