import "server-only";
import { withTransaction } from "@/lib/db/transaction";
import { generateToken, hashToken } from "@/lib/auth/tokenHash";
import { consumeLoginRateLimit } from "@/lib/auth/rateLimit";
import { clientIp } from "@/lib/auth/clientIp";
import * as repo from "@/lib/auth/qrRepository";
import type { QrPurpose } from "@/lib/auth/qrRepository";

const QR_TTL_SECONDS = 180;

export interface CreatedQrSession {
    token: string;
    expiresIn: number;
}

export const createQrSession = async (purpose: QrPurpose): Promise<CreatedQrSession | null> => {
    const ip = await clientIp();
    if (await consumeLoginRateLimit(ip, "")) return null;

    const { raw, hash } = generateToken();
    const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

    await repo.deleteExpiredQrSessions();
    await repo.insertQrSession(purpose, hash, expiresAt);

    return { token: raw, expiresIn: QR_TTL_SECONDS };
};

export const approveQrSession = async (rawToken: string, approvingUserId: number): Promise<"ok" | "invalid"> => {
    if (!rawToken || rawToken.length > 256) return "invalid";

    const approved = await repo.markQrSessionApproved(hashToken(rawToken), approvingUserId);
    return approved ? "ok" : "invalid";
};

export type QrCheckOutcome =
    | { status: "expired" | "pending" | "verification" }
    | { status: "approved"; userId: number };

export const checkQrSession = async (rawToken: string): Promise<QrCheckOutcome> => {
    if (!rawToken) return { status: "expired" };

    const tokenHash = hashToken(rawToken);

    return withTransaction(async (connection) => {
        const session = await repo.lockQrSessionByTokenHash(tokenHash, connection);

        if (!session || session.expiresAt.getTime() <= Date.now()) {
            if (session) await repo.deleteQrSessionById(session.id, connection);
            return { status: "expired" };
        }

        if (session.status === "awaiting_verification") return { status: "verification" };
        if (session.status === "pending") return { status: "pending" };

        if (session.status === "approved" && session.userId !== null) {
            await repo.deleteQrSessionById(session.id, connection);
            return { status: "approved", userId: session.userId };
        }

        return { status: "expired" };
    });
};
