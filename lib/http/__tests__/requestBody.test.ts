import { describe, expect, it } from "vitest";
import { readJsonBodyWithLimit, readTextBodyWithLimit, RequestBodyTooLargeError } from "../requestBody";

describe("ograniczony request body", () => {
    it("odrzuca Content-Length ponad limit przed odczytem", async () => {
        const request = new Request("http://localhost/api", { method: "POST", headers: { "Content-Length": "100" }, body: "{}" });
        await expect(readTextBodyWithLimit(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    });

    it("odrzuca chunked body po przekroczeniu limitu", async () => {
        const request = new Request("http://localhost/api", { method: "POST", body: "x".repeat(11) });
        await expect(readTextBodyWithLimit(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    });

    it("parsuje mały JSON", async () => {
        const request = new Request("http://localhost/api", { method: "POST", body: '{"ok":true}' });
        await expect(readJsonBodyWithLimit(request, 100)).resolves.toEqual({ ok: true });
    });
});
