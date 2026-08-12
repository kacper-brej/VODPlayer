import { afterEach, describe, expect, it } from "vitest";
import { isSameOriginMutation } from "../requestSecurity";

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
});

describe("same-origin mutation", () => {
    it("akceptuje wyłącznie skonfigurowany origin", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://nocturna.example";
        expect(isSameOriginMutation(new Request("https://internal/api", { headers: { Origin: "https://nocturna.example" } }))).toBe(true);
        expect(isSameOriginMutation(new Request("https://internal/api", { headers: { Origin: "https://evil.example" } }))).toBe(false);
    });

    it("nie ufa Host i odrzuca brak Origin", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://nocturna.example";
        expect(isSameOriginMutation(new Request("https://nocturna.example/api"))).toBe(false);
    });
});
