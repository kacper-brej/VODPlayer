type ProgressUpdate = () => void | Promise<void>;

export const createProgressQueue = () => {
    const pending = new Map<string, ProgressUpdate>();
    let inFlight: Promise<void> | null = null;

    const flush = (): Promise<void> => {
        if (inFlight) return inFlight;
        if (pending.size === 0) return Promise.resolve();

        inFlight = Promise.resolve().then(async () => {
            try {
                while (pending.size > 0) {
                    const [key, update] = pending.entries().next().value!;
                    pending.delete(key);
                    try {
                        await update();
                    } catch {
                    }
                }
            } finally {
                inFlight = null;
            }
        });
        return inFlight;
    };

    return {
        enqueue: (key: string, update: ProgressUpdate): Promise<void> => {
            pending.set(key, update);
            return flush();
        },
        flush,
    };
};
