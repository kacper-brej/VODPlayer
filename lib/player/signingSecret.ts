import "server-only";
import { requireSecret, type EnvSource } from "@/lib/config/env";

export const videoSigningBase = (env: EnvSource = process.env): string =>
    requireSecret(env, "VIDEO_SIGNING_SECRET", 32);
