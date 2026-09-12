export const createNotificationCountStore = (loadCount: () => Promise<number>) => {
    let count = 0;
    let revision = 0;
    let pending: Promise<void> | null = null;
    const listeners = new Set<() => void>();

    const update = (next: number) => {
        if (!Number.isSafeInteger(next) || next < 0) return;
        revision += 1;
        if (count === next) return;
        count = next;
        listeners.forEach((listener) => listener());
    };

    return {
        getSnapshot: () => count,
        subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        update,
        refresh: (): Promise<void> => {
            if (pending) return pending;
            const startedAtRevision = revision;
            pending = Promise.resolve().then(loadCount).then((next) => {
                if (revision === startedAtRevision) update(next);
            }).catch(() => undefined).finally(() => { pending = null; });
            return pending;
        },
    };
};
