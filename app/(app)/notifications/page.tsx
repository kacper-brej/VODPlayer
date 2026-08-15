import { DataErrorState } from "@/components/data/DataState";
import NotificationCenter, { type NotificationViewItem } from "@/components/notifications/NotificationCenter";
import { getCatalog } from "@/lib/catalog/catalog";
import { watchPath } from "@/lib/core/routes";
import { getNotifications } from "@/lib/notifications/notifications";

const NotificationsPage = async () => {
    const [notificationsResult, catalogResult] = await Promise.all([
        getNotifications(),
        getCatalog(),
    ]);

    if (notificationsResult.kind === "error") {
        return (
            <div className="min-h-screen bg-nx-bg px-5 py-16 sm:px-8 xl:px-10 min-[1440px]:px-12">
                <DataErrorState reason={notificationsResult.reason} headingLevel={1} />
            </div>
        );
    }

    const catalog = catalogResult.kind === "error" ? [] : catalogResult.data;
    const byKey = new Map(catalog.map((series) => [series.key, series]));
    const items: NotificationViewItem[] = notificationsResult.data.items.map((notification) => {
        const series = byKey.get(notification.seriesKey);
        const episode = series?.episodes.find((entry) => entry.key === notification.episodeKey);

        return {
            id: notification.id,
            title: series?.baseTitle ?? series?.title ?? notification.seriesKey,
            episodeLabel: episode ? `odcinek ${episode.number}` : "odcinek",
            href: watchPath(notification.seriesKey, notification.episodeKey),
            createdAt: notification.createdAt,
        };
    });

    return (
        <div className="min-h-screen bg-nx-bg px-5 pb-[calc(80px+env(safe-area-inset-bottom))] pt-12 sm:px-8 lg:pb-20 lg:pt-16 xl:px-10 min-[1440px]:px-12">
            <header className="mb-10 max-w-4xl border-b border-nx-border pb-8 sm:mb-12">
                <span className="font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">
                    AKTUALIZACJE / {items.length}
                </span>
                <h1 className="mt-4 max-w-[14ch] text-balance font-display text-[34px] leading-[.95] tracking-[-0.03em] text-nx-text sm:text-[40px] lg:text-[44px]">
                    Powiadomienia
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-nx-text-2">
                    Nowe odcinki tytułów zapisanych na Twojej liście.
                </p>
            </header>

            <NotificationCenter
                key={items.map((item) => item.id).join(":")}
                initialItems={items}
                initialCount={notificationsResult.data.count}
            />
        </div>
    );
};

export default NotificationsPage;
