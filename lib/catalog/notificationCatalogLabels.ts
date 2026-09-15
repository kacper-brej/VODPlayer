import "server-only";
import { loadCatalogPayload } from "@/lib/catalog/catalog";
import type { NotificationItem } from "@/lib/core/contracts";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export interface NotificationCatalogLabels {
    title: string;
    episodeNumbers: Map<string, number>;
}

export const getNotificationCatalogLabels = async (
    notifications: ReadonlyArray<Pick<NotificationItem, "seriesKey" | "episodeKey">>,
): Promise<DataResult<Map<string, NotificationCatalogLabels>>> => {
    const labels = new Map<string, NotificationCatalogLabels>();
    if (notifications.length === 0) return dataEmpty(labels);

    const requestedEpisodes = new Map<string, Set<string>>();
    for (const notification of notifications) {
        let episodes = requestedEpisodes.get(notification.seriesKey);
        if (!episodes) {
            episodes = new Set<string>();
            requestedEpisodes.set(notification.seriesKey, episodes);
        }
        episodes.add(notification.episodeKey);
    }

    try {
        const payload = await loadCatalogPayload();
        for (const series of payload.series) {
            const requested = requestedEpisodes.get(series.key);
            if (!requested) continue;

            const episodeNumbers = new Map<string, number>();
            for (const episode of series.episodes) {
                if (!requested.delete(episode.key)) continue;
                episodeNumbers.set(episode.key, episode.number);
                if (requested.size === 0) break;
            }
            labels.set(series.key, {
                title: series.baseTitle ?? series.title,
                episodeNumbers,
            });
            requestedEpisodes.delete(series.key);
            if (requestedEpisodes.size === 0) break;
        }

        return labels.size === 0 ? dataEmpty(labels) : dataSuccess(labels);
    } catch (error) {
        console.error("Notification catalog labels request failed:", error);
        return dataFailure("server");
    }
};
