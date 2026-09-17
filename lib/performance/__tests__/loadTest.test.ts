import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runLoadTest } from "../../../scripts/performance-load.mjs";

let server: ReturnType<typeof createServer> | undefined;
afterEach(async () => {
    server?.closeAllConnections();
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
});

describe("HTTP load test", () => {
    it("enforces concurrency and counts login redirects and timeouts as failures", async () => {
        let active = 0;
        let peak = 0;
        server = createServer((request, response) => {
            active += 1;
            peak = Math.max(peak, active);
            response.on("close", () => { active -= 1; });
            if (request.url?.startsWith("/hang")) return;
            setTimeout(() => {
                if (request.url?.startsWith("/private")) response.writeHead(307, { location: "/login" });
                response.end("ok");
            }, 10);
        });
        await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
        const address = server.address() as { port: number };
        const report = await runLoadTest({ baseUrl: `http://127.0.0.1:${address.port}`, paths: ["/ok?secret=abc", "/private", "/hang"], concurrency: 2, requests: 6, timeoutMs: 100 });
        expect(report.failures).toBe(4);
        expect(peak).toBeLessThanOrEqual(2);
        expect(report.groups.find((group: { path: string }) => group.path === "/private")).toMatchObject({ p50Ms: null, statuses: { 307: 2 } });
        expect(JSON.stringify(report)).not.toContain("secret");
    });
});
