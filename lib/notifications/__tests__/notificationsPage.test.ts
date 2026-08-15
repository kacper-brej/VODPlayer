import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("notifications workflow", () => {
    it("tworzy powiadomienia podczas publikacji gotowego odcinka", () => {
        const repository = source("lib/media/mediaRegistryRepository.ts");

        expect(repository).toContain("INSERT IGNORE INTO notifications");
        expect(repository).toContain("FROM watchlist");
        expect(repository).toContain("input.episodeKey, input.seriesKey");
    });

    it("udostępnia centrum nieprzeczytanych powiadomień", () => {
        const page = source("app/(app)/notifications/page.tsx");
        const center = source("components/notifications/NotificationCenter.tsx");

        expect(page).toContain("getNotifications()");
        expect(page).toContain("watchPath(notification.seriesKey, notification.episodeKey)");
        expect(center).toContain("markNotificationReadAction(notificationId)");
        expect(center).toContain("markAllNotificationsReadAction()");
    });

    it("prowadzi do centrum z menu profilu i aktualizuje licznik", () => {
        const menu = source("components/layout/ProfileMenu.tsx");
        const center = source("components/notifications/NotificationCenter.tsx");

        expect(menu).toContain('href="/notifications"');
        expect(menu).toContain("NOTIFICATIONS_CHANGED_EVENT");
        expect(center).toContain("NOTIFICATIONS_CHANGED_EVENT");
    });
});
