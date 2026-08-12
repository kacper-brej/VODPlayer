import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getNotifications as getNotificationsFromService } from "@/lib/notifications/notificationService";
import type { NotificationItem, NotificationsResponse } from "@/lib/core/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    type DataResult,
} from "@/lib/core/dataResult";

export type { NotificationItem, NotificationsResponse };

const loadNotifications = async (): Promise<DataResult<NotificationsResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const notifications = await getNotificationsFromService(user.id, user.username);
        return notifications.count === 0 && notifications.items.length === 0
            ? dataEmpty(notifications)
            : dataSuccess(notifications);
    } catch (error) {
        console.error("getNotifications failed:", error);
        return dataFailure("server");
    }
};

export const getNotifications = cache(loadNotifications);
