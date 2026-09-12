"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getUnreadNotificationsCountAction } from "@/lib/notifications/notificationsActions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications/notificationEvents";
import { createNotificationCountStore } from "@/lib/notifications/notificationCountStore";

const NotificationCountContext = createContext(0);
const serverCount = () => 0;

export const NotificationCountProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const store = useMemo(() => createNotificationCountStore(
        userId === null ? async () => 0 : getUnreadNotificationsCountAction,
    ), [userId]);
    const count = useSyncExternalStore(store.subscribe, store.getSnapshot, serverCount);

    useEffect(() => {
        if (userId === null) return;
        const handleChange = (event: Event) => store.update((event as CustomEvent<number>).detail);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChange);
        void store.refresh();
        return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChange);
    }, [store, userId]);

    return <NotificationCountContext.Provider value={count}>{children}</NotificationCountContext.Provider>;
};

export const useNotificationCount = () => useContext(NotificationCountContext);
