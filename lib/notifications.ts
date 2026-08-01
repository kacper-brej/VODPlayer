import { cache } from "react";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateNotificationsResponse,
    type NotificationItem,
    type NotificationsResponse,
} from "@/lib/contracts";
import {
    dataEmpty,
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

export type { NotificationItem, NotificationsResponse };

const loadNotifications = async (): Promise<DataResult<NotificationsResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const profileParam = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : "";
        const res = await fetch(`${VOD_ORIGIN}/notifications.php${profileParam}`, {
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("notifications.php GET ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateNotificationsResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return result.data.count === 0 && result.data.items.length === 0
            ? dataEmpty(result.data)
            : dataSuccess(result.data);
    } catch (error) {
        console.error("Notifications request failed:", error);
        return dataFailure("network");
    }
};

export const getNotifications = cache(loadNotifications);
