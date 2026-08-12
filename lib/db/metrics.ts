import "server-only";

interface MutableMetric {
    count: number;
    failures: number;
    totalMs: number;
    maxMs: number;
}

export interface DbMetricSnapshot extends MutableMetric {
    operation: string;
    averageMs: number;
}

const metrics = new Map<string, MutableMetric>();
const SAFE_OPERATION = /^[a-z0-9_.-]{1,80}$/i;

export const observeDbOperation = async <T>(operation: string, work: () => Promise<T>): Promise<T> => {
    if (!SAFE_OPERATION.test(operation)) throw new Error("invalid_db_metric_operation");
    const startedAt = performance.now();
    let failed = false;
    try {
        return await work();
    } catch (error) {
        failed = true;
        throw error;
    } finally {
        const elapsedMs = performance.now() - startedAt;
        const current = metrics.get(operation) ?? { count: 0, failures: 0, totalMs: 0, maxMs: 0 };
        current.count += 1;
        current.failures += failed ? 1 : 0;
        current.totalMs += elapsedMs;
        current.maxMs = Math.max(current.maxMs, elapsedMs);
        metrics.set(operation, current);
    }
};

export const getDbMetricsSnapshot = (): DbMetricSnapshot[] => [...metrics.entries()].map(([operation, value]) => ({
    operation,
    ...value,
    averageMs: value.count === 0 ? 0 : value.totalMs / value.count,
}));

export const resetDbMetricsForTests = (): void => metrics.clear();
