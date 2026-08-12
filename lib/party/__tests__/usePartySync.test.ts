import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "../usePartySync.ts"), "utf8");

describe("granice usePartySync", () => {
    it("nie dotyka VideoPlayer ani elementu wideo", () => {
        expect(source).not.toMatch(/VideoPlayer|HTMLVideoElement|currentTime\s*=/u);
    });

    it("nie używa requestAnimationFrame ani cyklicznego odczytu stanu z bazy", () => {
        expect(source).not.toContain("requestAnimationFrame");
        expect(source).toContain("CORRECTION_INTERVAL_MS = 1000");
        expect(source).toContain("CLOCK_REFRESH_INTERVAL_MS = 5 * 60 * 1000");
        expect(source).not.toMatch(/setInterval\(\s*\(\)\s*=>\s*(?:void\s+)?resync/u);
    });

    it("po otwarciu i ponownym otwarciu kanału odbudowuje stan z GET", () => {
        expect(source).toMatch(/source\.onopen[\s\S]*resync\(\)\.then/u);
    });

    it("ponawia kanał z ograniczonym backoffem i wystawia jawne wyjście do trybu solo", () => {
        expect(source).toContain("partyReconnectDelay(reconnectAttempt)");
        expect(source).toContain("Utracono połączenie z pokojem.");
        expect(source).toContain("continueAlone");
        expect(source).toContain("retryConnection");
    });

    it("wysyła heartbeat bez cyklicznego odczytu pełnego stanu", () => {
        expect(source).toContain("PARTY_HEARTBEAT_INTERVAL_MS");
        expect(source).toContain("/heartbeat`");
    });

    it("wysyła wyłącznie intencję i stosuje zdarzenie po odpowiedzi serwera", () => {
        const fetchIndex = source.indexOf("/command`");
        const parseIndex = source.indexOf("partyEventFromResponse", fetchIndex);
        const applyIndex = source.indexOf("applyEvent(event)", parseIndex);

        expect(fetchIndex).toBeGreaterThan(-1);
        expect(parseIndex).toBeGreaterThan(fetchIndex);
        expect(applyIndex).toBeGreaterThan(parseIndex);
    });
});
