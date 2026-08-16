import "server-only";
import { createHmac } from "node:crypto";
import { videoSigningBase } from "@/lib/player/signingSecret";

// Kontrakt odwzorowuje backend-php/video_signing.php (wariant library-scan v1).
// Osobny lancuch kontekstu: podpis listingu nie moze byc wymienny z podpisem
// strumienia ani podgladu, mimo wspolnego sekretu bazowego.
const SIGNATURE_VERSION = "v1";
const LIBRARY_SCAN_SIGNATURE_CONTEXT = "nocturna/library-scan/v1";

// Krotko, bo adres powstaje tuz przed zadaniem i nigdzie nie jest zapisywany.
export const LIBRARY_SCAN_URL_TTL_SECONDS = 300;

const scanSigningKey = () =>
    createHmac("sha256", videoSigningBase()).update(LIBRARY_SCAN_SIGNATURE_CONTEXT).digest();

export const libraryScanSignaturePayload = (expiresAt: number): string =>
    [SIGNATURE_VERSION, String(expiresAt)].join("\n");

export const signLibraryScanRequest = (expiresAt: number): string =>
    createHmac("sha256", scanSigningKey())
        .update(libraryScanSignaturePayload(expiresAt))
        .digest("hex");
