import "server-only";
import { requireHttpsUrl, type EnvSource } from "@/lib/config/env";

// Origin hostingu, na którym leżą pliki MP4 serwowane przez stream.php.
// To jest wyłącznie adres - nie przełącznik zachowania. O tym, czy odcinek
// gra plikiem czy segmentami, decyduje kolumna delivery w media_assets.
export const FILE_ORIGIN_ENV = "MEDIA_FILE_ORIGIN";

export const fileStreamOrigin = (env: EnvSource = process.env): string =>
    requireHttpsUrl(env, FILE_ORIGIN_ENV).replace(/\/+$/u, "");

export const isFileDeliveryConfigured = (env: EnvSource = process.env): boolean =>
    Boolean(env[FILE_ORIGIN_ENV]?.trim());
