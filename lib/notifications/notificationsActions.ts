"use server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import {
    getUnreadNotificationsCount,
    markNotificationRead as markNotificationReadInService,
    markAllNotificationsRead as markAllNotificationsReadInService,
} from "@/lib/notifications/notificationService";
import type { MarkNotificationsReadResponse } from "@/lib/core/contracts";
import {
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";

export const markAllNotificationsReadAction = async (): Promise<DataResult<MarkNotificationsReadResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await markAllNotificationsReadInService(user.id, user.username);
    if (!result.ok) return dataFailure("server");

    revalidatePath("/notifications");
    return dataSuccess({ success: true });
};

export const markNotificationReadAction = async (
    notificationId: number,
): Promise<DataResult<MarkNotificationsReadResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await markNotificationReadInService(user.id, user.username, notificationId);
    if (!result.ok) return dataFailure(result.code === "invalid" ? "invalid_response" : "server");

    revalidatePath("/notifications");
    return dataSuccess({ success: true });
};

export const getUnreadNotificationsCountAction = async (): Promise<number> => {
    const user = await getSessionUser();
    if (!user) return 0;

    try {
        return await getUnreadNotificationsCount(user.id, user.username);
    } catch (error) {
        console.error("getUnreadNotificationsCount failed:", error);
        return 0;
    }
};
