import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    arePartiesEnabled,
    issueChannelToken,
    partyChannelName,
    PartyChannelError,
    publishPartyEvent,
} from "../realtimeChannel";

const KEY_NAME = "abcd12";
const KEY_SECRET = "s3cr3t-value-never-leaves-the-server";
const env = {
    PARTY_REALTIME_KEY: `${KEY_NAME}:${KEY_SECRET}`,
    PARTY_REALTIME_REST_ORIGIN: "https://rest.example.test",
    PARTY_REALTIME_STREAM_ORIGIN: "https://stream.example.test",
};

const fetchMock = vi.fn();

const tokenResponse = (token = "token-for-one-room") => ({
    ok: true,
    json: async () => ({ token, expires: 1_700_000_900_000 }),
});

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("konfiguracja kanału", () => {
    it("brak klucza daje zdefiniowany błąd wyłączonej funkcji, bez żadnego żądania", async () => {
        await expect(issueChannelToken("KXRT49", {})).rejects.toMatchObject({
            name: "PartyChannelError",
            code: "disabled",
            httpStatus: 503,
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("klucz w złym formacie jest błędem konfiguracji, nie awarią usługi", async () => {
        await expect(issueChannelToken("KXRT49", { PARTY_REALTIME_KEY: "bezseparatora" }))
            .rejects.toMatchObject({ code: "misconfigured" });
        await expect(issueChannelToken("KXRT49", { PARTY_REALTIME_KEY: "nazwa:" }))
            .rejects.toMatchObject({ code: "misconfigured" });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("obecność klucza rozstrzyga, czy pokoje są włączone", () => {
        expect(arePartiesEnabled({})).toBe(false);
        expect(arePartiesEnabled({ PARTY_REALTIME_KEY: "   " })).toBe(false);
        expect(arePartiesEnabled(env)).toBe(true);
    });
});

describe("token kanału", () => {
    it("ma zakres jednego pokoju i wyłącznie prawo nasłuchu", async () => {
        fetchMock.mockResolvedValueOnce(tokenResponse());

        await issueChannelToken("KXRT49", env);

        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe(`https://rest.example.test/keys/${KEY_NAME}/requestToken`);
        const body = JSON.parse((init as RequestInit).body as string) as { capability: string; ttl: number };
        expect(JSON.parse(body.capability)).toEqual({ "party:KXRT49": ["subscribe"] });
        expect(body.ttl).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it("żądanie tokenu niesie komplet pól wymaganych przez usługę", async () => {
        fetchMock.mockResolvedValueOnce(tokenResponse());
        const before = Date.now();

        await issueChannelToken("KXRT49", env);

        const [, init] = fetchMock.mock.calls[0] ?? [];
        const body = JSON.parse((init as RequestInit).body as string) as { keyName: string; timestamp: number };
        expect(body.keyName).toBe(KEY_NAME);
        expect(body.timestamp).toBeGreaterThanOrEqual(before);
        expect(body.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it("token jednego pokoju nie obejmuje innego", async () => {
        fetchMock.mockResolvedValue(tokenResponse());

        await issueChannelToken("KXRT49", env);
        await issueChannelToken("MPQZ71", env);

        const capabilities = fetchMock.mock.calls.map(([, init]) =>
            JSON.parse(JSON.parse((init as RequestInit).body as string).capability) as Record<string, string[]>);

        expect(Object.keys(capabilities[0] ?? {})).toEqual(["party:KXRT49"]);
        expect(Object.keys(capabilities[1] ?? {})).toEqual(["party:MPQZ71"]);
    });

    it("adres strumienia niesie token, a nigdy sekretu konta", async () => {
        fetchMock.mockResolvedValueOnce(tokenResponse());

        const grant = await issueChannelToken("KXRT49", env);

        expect(grant.streamUrl).toContain("stream.example.test");
        expect(grant.streamUrl).toContain("accessToken=token-for-one-room");
        expect(grant.streamUrl).not.toContain(KEY_SECRET);
        expect(grant.channelName).toBe("party:KXRT49");
    });

    it("odpowiedź bez tokenu jest awarią usługi, nie pustym adresem", async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        await expect(issueChannelToken("KXRT49", env)).rejects.toMatchObject({ code: "upstream" });
    });

    it("odmowa usługi nie wycieka jej odpowiedzi do wywołującego", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "bad key" }) });

        await expect(issueChannelToken("KXRT49", env)).rejects.toMatchObject({ code: "upstream" });
    });

    it("brak odpowiedzi usługi daje błąd domenowy, nie wyjątek z fetch", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network down"));

        const error = await issueChannelToken("KXRT49", env).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(PartyChannelError);
        expect((error as PartyChannelError).message).not.toContain("network down");
    });
});

describe("rozgłaszanie zdarzeń", () => {
    it("trafia w kanał tego pokoju i uwierzytelnia się kluczem serwera", async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        await publishPartyEvent("KXRT49", { name: "pause", data: { positionSeconds: 12 } }, env);

        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(url).toBe("https://rest.example.test/channels/party%3AKXRT49/messages");
        expect((init as RequestInit).headers).toMatchObject({
            Authorization: `Basic ${Buffer.from(env.PARTY_REALTIME_KEY, "utf8").toString("base64")}`,
        });
    });

    it("nieudane rozesłanie jest błędem domenowym", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

        await expect(publishPartyEvent("KXRT49", { name: "pause", data: {} }, env))
            .rejects.toMatchObject({ code: "upstream" });
    });

    it("nazwa kanału jest wyprowadzana wyłącznie z kodu pokoju", () => {
        expect(partyChannelName("KXRT49")).toBe("party:KXRT49");
    });
});

describe("izolacja dostawcy", () => {
    const projectRoot = resolve(__dirname, "../../..");

    const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
        const path = resolve(directory, entry);
        if (statSync(path).isDirectory()) return walk(path);
        return /\.tsx?$/u.test(entry) ? [path] : [];
    });

    it("nazwa usługi występuje wyłącznie w adapterze", () => {
        const sources = [...walk(resolve(projectRoot, "lib")), ...walk(resolve(projectRoot, "components"))];

        const offenders = sources
            .filter((path) => /\bably\b/iu.test(readFileSync(path, "utf8")))
            .map((path) => path.slice(projectRoot.length + 1).replace(/\\/gu, "/"));

        expect(offenders).toEqual(["lib/party/realtimeChannel.ts"]);
    });
});
