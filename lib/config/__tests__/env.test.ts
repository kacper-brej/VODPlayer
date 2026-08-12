import { describe, expect, it } from "vitest";
import { EnvironmentConfigError, requireSecret } from "../env";
import { isAuthGateDisabled, readApplicationUrl, readSessionSecret } from "@/lib/auth/authConfig";
import { videoSigningBase } from "@/lib/player/signingSecret";
import { readMediaRegistrySecret } from "@/lib/media/mediaRegistryAuth";
import { B2ConfigError, readB2Config } from "@/lib/player/b2Storage";
import { ArtworkStorageConfigError, readArtworkStorageConfig } from "@/lib/artwork/artworkStorage";
import { DeleteB2ConfigError, readDeleteB2Config } from "@/lib/admin/b2AdminStorage";
import { readMailConfig } from "@/lib/mail/mailConfig";

const secret = "s".repeat(32);
const sharedB2 = { B2_ENDPOINT: "s3.example.test", B2_REGION: "eu-test-1", B2_BUCKET: "bucket" };

describe("walidacja sekretów", () => {
    it("odrzuca brak, pustą i krótką wartość oraz liczy bajty UTF-8", () => {
        expect(() => requireSecret({}, "SECRET")).toThrow(EnvironmentConfigError);
        expect(() => requireSecret({ SECRET: "   " }, "SECRET")).toThrow(EnvironmentConfigError);
        expect(() => requireSecret({ SECRET: "a".repeat(31) }, "SECRET")).toThrow("32 bajty");
        expect(requireSecret({ SECRET: "ą".repeat(16) }, "SECRET")).toBe("ą".repeat(16));
    });

    it("wymaga niezależnych sekretów sesji, wideo i rejestru bez JWT fallbacku", () => {
        expect(readSessionSecret({ SESSION_SECRET: secret })).toBe(secret);
        expect(videoSigningBase({ VIDEO_SIGNING_SECRET: secret })).toBe(secret);
        expect(readMediaRegistrySecret({ MEDIA_REGISTRY_SECRET: secret })).toBe(secret);
        expect(() => videoSigningBase({ JWT_SECRET: secret })).toThrow("VIDEO_SIGNING_SECRET");
        expect(() => readMediaRegistrySecret({ JWT_SECRET: secret })).toThrow("MEDIA_REGISTRY_SECRET");
    });
});

describe("URL aplikacji i bramka auth", () => {
    it("dopuszcza localhost tylko poza produkcją, a w produkcji wymaga HTTPS", () => {
        expect(readApplicationUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
        expect(readApplicationUrl({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://app.example.test/" }))
            .toBe("https://app.example.test");
        expect(() => readApplicationUrl({ NODE_ENV: "production" })).toThrow("NEXT_PUBLIC_APP_URL");
        expect(() => readApplicationUrl({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "http://app.example.test" }))
            .toThrow("HTTPS");
    });

    it("zabrania wyłączenia bramki w produkcji", () => {
        expect(isAuthGateDisabled({ NODE_ENV: "development", DISABLE_AUTH_GATE: "true" })).toBe(true);
        expect(isAuthGateDisabled({ NODE_ENV: "production", DISABLE_AUTH_GATE: "false" })).toBe(false);
        expect(() => isAuthGateDisabled({ NODE_ENV: "production", DISABLE_AUTH_GATE: "true" }))
            .toThrow("zabronione");
    });
});

describe("konfiguracje B2 per rola", () => {
    it("wymaga pełnej pary playback read", () => {
        expect(readB2Config({ ...sharedB2, B2_READ_KEY_ID: "id", B2_READ_APP_KEY: "key" }).readKeyId).toBe("id");
        expect(() => readB2Config({ ...sharedB2, B2_READ_KEY_ID: "id", B2_READ_APP_KEY: " " }))
            .toThrow(B2ConfigError);
    });

    it("wymaga pełnej pary artwork write i delete", () => {
        expect(readArtworkStorageConfig({
            ...sharedB2,
            B2_ARTWORK_WRITE_KEY_ID: "id",
            B2_ARTWORK_WRITE_APP_KEY: "key",
        }).keyId).toBe("id");
        expect(() => readArtworkStorageConfig({ ...sharedB2, B2_ARTWORK_WRITE_KEY_ID: "id" }))
            .toThrow(ArtworkStorageConfigError);
        expect(readDeleteB2Config({ ...sharedB2, B2_DELETE_KEY_ID: "id", B2_DELETE_APP_KEY: "key" }).appKey)
            .toBe("key");
        expect(() => readDeleteB2Config({ ...sharedB2, B2_DELETE_KEY_ID: "id" }))
            .toThrow(DeleteB2ConfigError);
    });
});

describe("SMTP", () => {
    it("waliduje wymagane pola i port", () => {
        const env = { SMTP_HOST: "smtp.example.test", SMTP_USER: "user", SMTP_PASSWORD: "password" };
        expect(readMailConfig(env)).toMatchObject({ port: 465, fromName: "Nocturna" });
        expect(() => readMailConfig({ ...env, SMTP_PASSWORD: " " })).toThrow("SMTP_PASSWORD");
        expect(() => readMailConfig({ ...env, SMTP_PORT: "0" })).toThrow("SMTP_PORT");
    });
});
