import "server-only";
import { parseOptionalInteger, requireEnvValue, type EnvSource } from "@/lib/config/env";

export interface MailConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    fromName: string;
}

export const readMailConfig = (env: EnvSource = process.env): MailConfig => ({
    host: requireEnvValue(env, "SMTP_HOST"),
    port: parseOptionalInteger(env, "SMTP_PORT", 465, 1, 65_535),
    user: requireEnvValue(env, "SMTP_USER"),
    password: requireEnvValue(env, "SMTP_PASSWORD"),
    fromName: env.SMTP_FROM_NAME?.trim() || "Nocturna",
});
