import "server-only";

// Process-local only: callers must still authorize the viewer and check the asset.
export const createSignedPlaylistCache = ({
    now = () => Date.now(),
    maxEntries = 128,
    maxBytes = 32 * 1024 * 1024,
} = {}) => {
    const entries = new Map<string, { body: string; expiresAt: number; bytes: number }>();
    let bytes = 0;
    const remove = (key: string) => {
        bytes -= entries.get(key)?.bytes ?? 0;
        entries.delete(key);
    };
    return {
        get(key: string): string | null {
            const entry = entries.get(key);
            if (!entry) return null;
            if (entry.expiresAt <= now()) { remove(key); return null; }
            entries.delete(key);
            entries.set(key, entry);
            return entry.body;
        },
        set(key: string, body: string, expiresAt: number) {
            remove(key);
            for (const [id, entry] of entries) if (entry.expiresAt <= now()) remove(id);
            // Budget UTF-16 string storage, including the key, not just entry count.
            const size = (key.length + body.length) * 2;
            if (size > maxBytes || expiresAt <= now() || maxEntries < 1) return;
            while (entries.size >= maxEntries || bytes + size > maxBytes) {
                remove(entries.keys().next().value!);
            }
            entries.set(key, { body, expiresAt, bytes: size });
            bytes += size;
        },
        clear() { entries.clear(); bytes = 0; },
    };
};
