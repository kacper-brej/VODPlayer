import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsPage from "@/app/(app)/notifications/page";
import { watchPath } from "@/lib/core/routes";

const mocks = vi.hoisted(() => ({
    getNotifications: vi.fn(),
    getNotificationCatalogLabels: vi.fn(),
    center: vi.fn(() => null),
    error: vi.fn(() => null),
}));

vi.mock("@/lib/notifications/notifications", () => ({ getNotifications: mocks.getNotifications }));
vi.mock("@/lib/catalog/notificationCatalogLabels", () => ({ getNotificationCatalogLabels: mocks.getNotificationCatalogLabels }));
vi.mock("@/components/notifications/NotificationCenter", () => ({ default: mocks.center }));
vi.mock("@/components/data/DataState", () => ({ DataErrorState: mocks.error }));

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNotifications.mockResolvedValue({ kind: "empty", data: { count: 0, items: [] } });
    mocks.getNotificationCatalogLabels.mockResolvedValue({ kind: "empty", data: new Map() });
});

describe("notification page data", () => {
    it.each(["unauthorized", "server"])("preserves %s errors without loading catalog labels", async (reason) => {
        mocks.getNotifications.mockResolvedValue({ kind: "error", reason });

        renderToStaticMarkup(await NotificationsPage());

        expect(mocks.getNotificationCatalogLabels).not.toHaveBeenCalled();
        expect(mocks.center).not.toHaveBeenCalled();
        expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ reason, headingLevel: 1 }), undefined);
    });

    it("preserves notification order, count, timestamps, links and missing-title fallbacks", async () => {
        const items = [
            { id: 8, seriesKey: "present", episodeKey: "02.mp4", createdAt: 400 },
            { id: 3, seriesKey: "missing", episodeKey: "special.mp4", createdAt: 300 },
            { id: 2, seriesKey: "present", episodeKey: "unknown.mp4", createdAt: 200 },
        ];
        mocks.getNotifications.mockResolvedValue({ kind: "success", data: { count: 9, items } });
        mocks.getNotificationCatalogLabels.mockResolvedValue({
            kind: "success",
            data: new Map([["present", { title: "Published title", episodeNumbers: new Map([["02.mp4", 2]]) }]]),
        });

        const html = renderToStaticMarkup(await NotificationsPage());

        expect(mocks.getNotificationCatalogLabels).toHaveBeenCalledWith(items);
        expect(mocks.center).toHaveBeenCalledWith(expect.objectContaining({
            initialCount: 9,
            initialItems: [
                { id: 8, title: "Published title", episodeLabel: "odcinek 2", href: watchPath("present", "02.mp4"), createdAt: 400 },
                { id: 3, title: "missing", episodeLabel: "odcinek", href: watchPath("missing", "special.mp4"), createdAt: 300 },
                { id: 2, title: "Published title", episodeLabel: "odcinek", href: watchPath("present", "unknown.mp4"), createdAt: 200 },
            ],
        }), undefined);
        expect(html).toContain("AKTUALIZACJE / 3");
    });

    it("renders readable notifications when the catalog is unavailable", async () => {
        mocks.getNotifications.mockResolvedValue({ kind: "success", data: {
            count: 1,
            items: [{ id: 7, seriesKey: "Series key", episodeKey: "03.mp4", createdAt: 100 }],
        } });
        mocks.getNotificationCatalogLabels.mockResolvedValue({ kind: "error", reason: "server" });

        renderToStaticMarkup(await NotificationsPage());

        expect(mocks.error).not.toHaveBeenCalled();
        expect(mocks.center).toHaveBeenCalledWith(expect.objectContaining({
            initialCount: 1,
            initialItems: [{ id: 7, title: "Series key", episodeLabel: "odcinek", href: watchPath("Series key", "03.mp4"), createdAt: 100 }],
        }), undefined);
    });

    it("keeps the empty notification center", async () => {
        const html = renderToStaticMarkup(await NotificationsPage());

        expect(mocks.center).toHaveBeenCalledWith(expect.objectContaining({ initialCount: 0, initialItems: [] }), undefined);
        expect(html).toContain("AKTUALIZACJE / 0");
    });
});
