import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const readCsp = async (env: Record<string, string | undefined>): Promise<string> => {
    vi.resetModules();
    for (const key of ["B2_ENDPOINT", "PARTY_REALTIME_STREAM_ORIGIN"]) delete process.env[key];
    Object.assign(process.env, env);

    const config = (await import("@/next.config")).default;
    const rules = await config.headers?.() ?? [];
    const header = rules[0]?.headers.find((entry) => entry.key === "Content-Security-Policy");

    return header?.value ?? "";
};

const directive = (csp: string, name: string): string =>
    csp.split("; ").find((part) => part.startsWith(`${name} `))?.slice(name.length + 1) ?? "";

afterEach(() => {
    process.env = { ...originalEnv };
});

describe("Content-Security-Policy dla kanału pokoju", () => {
    it("bez skonfigurowanego strumienia nie wpuszcza żadnego obcego hosta", async () => {
        const csp = await readCsp({});

        expect(directive(csp, "connect-src")).toBe("'self' blob:");
    });

    it("dopuszcza dokładnie jeden host strumienia obok dotychczasowych źródeł", async () => {
        const csp = await readCsp({
            B2_ENDPOINT: "https://s3.eu-central.example.test",
            PARTY_REALTIME_STREAM_ORIGIN: "https://stream.example.test",
        });

        expect(directive(csp, "connect-src")).toBe(
            "'self' blob: https://s3.eu-central.example.test https://stream.example.test",
        );
    });

    it("ze zmiennej bierze sam origin, bez ścieżki i parametrów", async () => {
        const csp = await readCsp({ PARTY_REALTIME_STREAM_ORIGIN: "https://stream.example.test/sse?v=1.2" });

        expect(directive(csp, "connect-src")).toBe("'self' blob: https://stream.example.test");
    });

    it("niepoprawna wartość nie rozluźnia polityki", async () => {
        const csp = await readCsp({ PARTY_REALTIME_STREAM_ORIGIN: "://nie-adres" });

        expect(directive(csp, "connect-src")).toBe("'self' blob:");
    });

    it("host strumienia nie przecieka do pozostałych dyrektyw", async () => {
        const csp = await readCsp({ PARTY_REALTIME_STREAM_ORIGIN: "https://stream.example.test" });

        expect(directive(csp, "default-src")).toBe("'self'");
        expect(directive(csp, "object-src")).toBe("'none'");
        expect(directive(csp, "frame-ancestors")).toBe("'none'");
        expect(directive(csp, "script-src")).not.toContain("stream.example.test");
        expect(directive(csp, "media-src")).not.toContain("stream.example.test");
    });
});
