import "server-only";
import { DatabaseError } from "@/lib/db/errors";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import type { NotificationsResponse } from "@/lib/core/contracts";
import * as repo from "@/lib/notifications/notificationRepository";

export const getNotifications = async (userId: number, username: string): Promise<NotificationsResponse> => {
    const profileId = await resolveOwnedProfileId(userId, username);
    const [count, items] = await Promise.all([
        repo.countUnreadNotifications(profileId),
        repo.listUnreadNotifications(profileId),
    ]);
    return { count, items };
};

export type MarkReadResult = { ok: true } | { ok: false; code: "invalid" | "server" };

export const markNotificationRead = async (
    userId: number,
    username: string,
    id: number,
): Promise<MarkReadResult> => {
    if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, code: "invalid" };

    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        await repo.markNotificationRead(id, profileId);
        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export const markAllNotificationsRead = async (userId: number, username: string): Promise<MarkReadResult> => {
    try {
        const profileId = await resolveOwnedProfileId(userId, username);
        await repo.markAllNotificationsRead(profileId);
        return { ok: true };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
