"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, Check, CheckCheck, Play } from "lucide-react";
import {
    markAllNotificationsReadAction,
    markNotificationReadAction,
} from "@/lib/notifications/notificationsActions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications/notificationEvents";

export interface NotificationViewItem {
    id: number;
    title: string;
    episodeLabel: string;
    href: string;
    createdAt: number;
}

const formatDate = (timestamp: number) => new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
}).format(new Date(timestamp * 1000));

const publishCount = (count: number) => {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: count }));
};

const NotificationCenter = ({
    initialItems,
    initialCount,
}: {
    initialItems: NotificationViewItem[];
    initialCount: number;
}) => {
    const router = useRouter();
    const [items, setItems] = useState(initialItems);
    const [unreadCount, setUnreadCount] = useState(initialCount);
    const [error, setError] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<number | "all" | null>(null);
    const [pending, startTransition] = useTransition();

    const removeLocally = (notificationId: number) => {
        setItems((current) => current.filter((item) => item.id !== notificationId));
        setUnreadCount((current) => {
            const next = Math.max(0, current - 1);
            publishCount(next);
            return next;
        });
    };

    const markOne = (notificationId: number, href?: string) => {
        setPendingId(notificationId);
        setError(null);
        startTransition(async () => {
            const result = await markNotificationReadAction(notificationId);
            if (result.kind === "success") {
                removeLocally(notificationId);
                router.refresh();
            } else {
                setError("Nie udało się oznaczyć powiadomienia jako przeczytanego.");
            }
            setPendingId(null);
            if (href) router.push(href);
        });
    };

    const markAll = () => {
        setPendingId("all");
        setError(null);
        startTransition(async () => {
            const result = await markAllNotificationsReadAction();
            if (result.kind === "success") {
                setItems([]);
                setUnreadCount(0);
                publishCount(0);
                router.refresh();
            } else {
                setError("Nie udało się oznaczyć wszystkich powiadomień.");
            }
            setPendingId(null);
        });
    };

    if (items.length === 0) {
        return (
            <div className="flex min-h-72 flex-col items-start justify-center border-y border-nx-border py-12">
                <Bell size={24} className="text-nx-text-2" aria-hidden="true" />
                <h2 className="mt-4 font-display text-[30px] leading-none tracking-[-0.03em] text-nx-text sm:text-[38px]">
                    Wszystko przeczytane
                </h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-nx-text-2">
                    Powiadomimy Cię, gdy do tytułu z Twojej listy zostanie dodany nowy odcinek.
                </p>
            </div>
        );
    }

    return (
        <section aria-labelledby="unread-notifications-title">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-nx-border pb-5">
                <h2 id="unread-notifications-title" className="text-xl font-semibold text-nx-text">
                    Nieprzeczytane ({unreadCount})
                </h2>
                <button
                    type="button"
                    onClick={markAll}
                    disabled={pending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-nx-border bg-nx-panel px-4 text-sm font-semibold text-nx-text outline-none hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:opacity-55"
                >
                    <CheckCheck size={17} aria-hidden="true" />
                    {pendingId === "all" ? "Zapisywanie…" : "Oznacz wszystkie"}
                </button>
            </div>

            <ul className="divide-y divide-nx-border border-y border-nx-border">
                {items.map((item) => (
                    <li key={item.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
                        <button
                            type="button"
                            onClick={() => markOne(item.id, item.href)}
                            disabled={pending}
                            className="group min-w-0 flex-1 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                        >
                            <span className="flex items-start gap-4">
                                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-accent transition-colors group-hover:bg-nx-raised">
                                    <Play size={16} fill="currentColor" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-base font-semibold text-nx-text">
                                        {item.title}
                                    </span>
                                    <span className="mt-1 block text-sm text-nx-text-2">
                                        Nowy {item.episodeLabel}
                                    </span>
                                    <time dateTime={new Date(item.createdAt * 1000).toISOString()} className="mt-2 block font-mono text-[10px] tracking-[0.12em] text-nx-text-2">
                                        {formatDate(item.createdAt)}
                                    </time>
                                </span>
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => markOne(item.id)}
                            disabled={pending}
                            aria-label={`Oznacz jako przeczytane: ${item.title}, ${item.episodeLabel}`}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-nx-border px-4 text-sm font-semibold text-nx-text-2 outline-none hover:border-nx-accent/50 hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:opacity-55"
                        >
                            <Check size={16} aria-hidden="true" />
                            Przeczytane
                        </button>
                    </li>
                ))}
            </ul>

            {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
        </section>
    );
};

export default NotificationCenter;
