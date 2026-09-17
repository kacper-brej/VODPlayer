import { pathToFileURL } from "node:url";

export const runLoadTest = async ({ baseUrl, paths, concurrency = 5, requests = 60, timeoutMs = 10000, cookie = "" }) => {
    const base = new URL(baseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error("Use an HTTP(S) URL without credentials.");
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50 || !Number.isInteger(requests) || requests < 1 || requests > 2000) throw new Error("Concurrency must be 1–50 and requests 1–2000.");
    if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error("Timeout must be 100–30000 ms.");
    if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) => !path.startsWith('/') || path.startsWith('//'))) throw new Error("Provide same-origin paths starting with /.");
    const targets = paths.map((path) => new URL(path, base));
    if (targets.some((target) => target.origin !== base.origin)) throw new Error("All paths must use the same origin.");
    const results = [];
    let next = 0;
    const started = performance.now();
    await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, async () => {
        while (next < requests) {
            const index = next++;
            const target = targets[index % targets.length];
            const start = performance.now();
            let status = 0;
            let bytes = 0;
            let ok = false;
            try {
                const response = await fetch(target, {
                    headers: cookie ? { cookie } : undefined,
                    signal: AbortSignal.timeout(timeoutMs),
                    redirect: "manual",
                });
                status = response.status;
                bytes = (await response.arrayBuffer()).byteLength;
                ok = response.ok;
            } catch {}
            results.push({ path: target.pathname, status, ok, bytes, elapsedMs: performance.now() - start });
        }
    }));
    const durationMs = performance.now() - started;
    const groups = [...new Set(results.map((result) => result.path))].map((path) => {
        const entries = results.filter((result) => result.path === path);
        const successful = entries.filter((result) => result.ok).map((result) => result.elapsedMs).sort((a, b) => a - b);
        const percentile = (fraction) => successful.length ? Math.round(successful[Math.ceil(successful.length * fraction) - 1]) : null;
        const statuses = {};
        for (const entry of entries) statuses[entry.status] = (statuses[entry.status] ?? 0) + 1;
        return { path, requests: entries.length, failures: entries.length - successful.length, p50Ms: percentile(0.5), p75Ms: percentile(0.75), p95Ms: percentile(0.95), maxMs: successful.length ? Math.round(successful.at(-1)) : null, statuses };
    });
    return { origin: base.origin, concurrency, requests, durationMs: Math.round(durationMs), requestsPerSecond: Number((requests * 1000 / durationMs).toFixed(2)), transferredBytes: results.reduce((sum, entry) => sum + entry.bytes, 0), failures: results.filter((result) => !result.ok).length, groups };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const args = new Map();
        for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
        const report = await runLoadTest({
            baseUrl: args.get("--url") ?? "http://127.0.0.1:3017",
            paths: (args.get("--paths") ?? "/").split(","),
            concurrency: Number(args.get("--concurrency") ?? "5"),
            requests: Number(args.get("--requests") ?? "60"),
            timeoutMs: Number(args.get("--timeout") ?? "10000"),
            cookie: process.env.LOAD_TEST_COOKIE ?? "",
        });
        console.log(JSON.stringify(report, null, 2));
        if (report.failures > 0) process.exitCode = 1;
    } catch (error) {
        console.error(error instanceof Error ? error.message : "Load test failed.");
        process.exitCode = 1;
    }
}
