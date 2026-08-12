import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { consumeMediaRequestNonce } from "../mediaRequestNonceRepository";

describe("media nonce replay cache", () => {
    it("zapisuje wyłącznie hash nonce", async () => {
        const execute = vi.fn().mockResolvedValue([{}]);
        await expect(consumeMediaRequestNonce("ab".repeat(32), 1_700_000_090, { execute } as never)).resolves.toBe(true);
        expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining("INSERT INTO media_request_nonces"), [
            createHash("sha256").update("ab".repeat(32)).digest("hex"),
            1_700_000_090,
        ]);
    });

    it("atomowo odrzuca powtórzony nonce po błędzie unikalności", async () => {
        const execute = vi.fn().mockRejectedValue({ code: "ER_DUP_ENTRY" });
        await expect(consumeMediaRequestNonce("cd".repeat(32), 1_700_000_090, { execute } as never)).resolves.toBe(false);
    });
});
