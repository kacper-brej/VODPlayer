import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "../passwordHash";

describe("verifyPassword", () => {
    it("akceptuje poprawne hasło z hashem w formacie PHP $2y$ (PASSWORD_DEFAULT)", async () => {
        const nativeHash = bcrypt.hashSync("correct-horse-battery-staple", 10);
        const phpStyleHash = nativeHash.replace(/^\$2[aby]\$/, "$2y$");

        await expect(verifyPassword("correct-horse-battery-staple", phpStyleHash)).resolves.toBe(true);
    });

    it("odrzuca złe hasło dla tego samego hasha $2y$", async () => {
        const nativeHash = bcrypt.hashSync("correct-horse-battery-staple", 10);
        const phpStyleHash = nativeHash.replace(/^\$2[aby]\$/, "$2y$");

        await expect(verifyPassword("wrong-password", phpStyleHash)).resolves.toBe(false);
    });
});
