"use server";
import { getNotifications } from "@/lib/notifications";
import { VOD_ORIGIN, selectedProfileId, sessionHeaders } from "@/lib/vodConfig";
import {
    validateMarkNotificationsReadResponse,
    type MarkNotificationsReadResponse,
} from "@/lib/contracts";
import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

const buildQuery = (params: Record<string, string | null>): string => {
    const entries = Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== null);
    if (entries.length === 0) return "";
    return `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
};

const markRead = async (id: number | null): Promise<DataResult<MarkNotificationsReadResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized");

    try {
        const profileId = await selectedProfileId();
        const query = buildQuery({
            action: "read",
            id: id === null ? null : String(id),
            profile_id: profileId,
        });
        const res = await fetch(`${VOD_ORIGIN}/notifications.php${query}`, {
            method: "POST",
            headers,
            cache: "no-store",
        });

        if (!res.ok) {
            console.error("notifications.php POST ->", res.status, await res.text());
            return failureFromStatus(res.status);
        }

        const payload: unknown = await res.json();
        const result = validateMarkNotificationsReadResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("markRead failed", error);
        return dataFailure("network");
    }
};

export const markAllNotificationsReadAction = async (): Promise<DataResult<MarkNotificationsReadResponse>> =>
    markRead(null);

export const markNotificationReadAction = async (
    notificationId: number,
): Promise<DataResult<MarkNotificationsReadResponse>> => markRead(notificationId);

export const getUnreadNotificationsCountAction = async (): Promise<number> => {
    const result = await getNotifications();
    return result.kind === "error" ? 0 : result.data.count;
};
