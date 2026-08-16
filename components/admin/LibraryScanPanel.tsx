"use client";

import { useCallback, useState } from "react";
import { HardDriveDownload, RefreshCw } from "lucide-react";
import type { LibraryEntry, LibraryEntryState } from "@/lib/media/libraryRegistration";

const STATE_LABEL: Record<LibraryEntryState, string> = {
    new: "Nowy na dysku",
    registered: "Zarejestrowany",
    hls: "Ma asset HLS",
    orphaned: "Brak pliku na dysku",
};

const STATE_CLASS: Record<LibraryEntryState, string> = {
    new: "border-nx-accent/50 bg-nx-accent/10 text-nx-accent",
    registered: "border-nx-border bg-nx-raised text-nx-text",
    hls: "border-nx-accent-2/40 bg-nx-accent-2/10 text-nx-accent-2",
    orphaned: "border-nx-critical/40 bg-nx-critical/10 text-nx-critical-soft",
};

const formatBytes = (bytes: number | null): string => {
    if (bytes === null) return "Brak danych";
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

const entryId = (entry: LibraryEntry) => `${entry.seriesKey}\u0000${entry.episodeKey}`;

export const LibraryScanPanel = () => {
    const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/library-scan", { cache: "no-store" });
            const payload = await response.json().catch(() => null) as
                { entries?: LibraryEntry[]; error?: string } | null;
            if (!response.ok || !payload?.entries) {
                setError(payload?.error ?? "Nie udało się odczytać zawartości serwera.");
                setEntries(null);
            } else {
                setEntries(payload.entries);
                setSelected(new Set());
            }
        } catch {
            setError("Brak połączenia z serwerem.");
        } finally {
            setBusy(false);
        }
    }, []);

    const registrable = entries?.filter((entry) => entry.state === "new") ?? [];

    const register = async () => {
        const chosen = registrable.filter((entry) => selected.has(entryId(entry)));
        if (chosen.length === 0) return;

        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/library-scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    episodes: chosen.map(({ seriesKey, episodeKey }) => ({ seriesKey, episodeKey })),
                }),
            });
            const payload = await response.json().catch(() => null) as
                { inserted?: number; skipped?: number; previewsLinked?: number; error?: string } | null;
            if (!response.ok) {
                setError(payload?.error ?? "Nie udało się zarejestrować odcinków.");
            } else {
                setNotice(`Zarejestrowano: ${payload?.inserted ?? 0}. Pominięto: ${payload?.skipped ?? 0}. Podpięte podglądy: ${payload?.previewsLinked ?? 0}.`);
                await load();
            }
        } catch {
            setError("Brak połączenia z serwerem.");
        } finally {
            setBusy(false);
        }
    };

    const toggle = (entry: LibraryEntry) => {
        const id = entryId(entry);
        setSelected((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={busy}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-nx-border bg-nx-panel px-5 text-sm font-semibold text-nx-text outline-none transition-[border-color,background-color,color] duration-140 hover:border-nx-accent/60 hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-50"
                >
                    <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
                    {busy ? "Przetwarzanie…" : "Skanuj serwer"}
                </button>
                <button
                    type="button"
                    onClick={() => void register()}
                    disabled={busy || selected.size === 0}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent outline-none transition-[filter,opacity] duration-140 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <HardDriveDownload className="size-4" aria-hidden="true" />
                    Zarejestruj zaznaczone ({selected.size})
                </button>
                {registrable.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setSelected(new Set(registrable.map(entryId)))}
                        disabled={busy}
                        className="min-h-11 cursor-pointer rounded-full px-3 text-sm text-nx-text-2 underline decoration-nx-border underline-offset-4 outline-none transition-colors duration-140 hover:text-nx-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-50"
                    >
                        Zaznacz wszystkie nowe ({registrable.length})
                    </button>
                )}
            </div>

            {error && (
                <p role="alert" className="rounded-[var(--r-s)] border border-nx-critical/40 bg-nx-critical/10 px-4 py-3 text-sm text-nx-critical-soft">
                    {error}
                </p>
            )}
            {notice && (
                <p role="status" className="rounded-[var(--r-s)] border border-nx-accent/30 bg-nx-accent/10 px-4 py-3 text-sm text-nx-text">
                    {notice}
                </p>
            )}

            {entries === null && !busy && !error && (
                <div className="rounded-[var(--r-m)] border border-dashed border-nx-border bg-nx-panel px-5 py-6 text-sm leading-6 text-nx-text-2">
                    Kliknij Skanuj serwer, aby sprawdzić pliki w katalogu{" "}
                    <code className="text-nx-text">uploads/</code>.
                </div>
            )}

            {entries !== null && entries.length === 0 && (
                <div className="rounded-[var(--r-m)] border border-dashed border-nx-border bg-nx-panel px-5 py-6 text-sm text-nx-text-2">
                    Na serwerze nie ma plików MP4 do zarejestrowania.
                </div>
            )}

            {entries !== null && entries.length > 0 && (
                <div className="overflow-x-auto rounded-[var(--r-m)] border border-nx-border bg-nx-panel shadow-[var(--sh-2)]">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-nx-border text-left font-mono text-[10px] uppercase tracking-[0.14em] text-nx-text-2">
                                <th scope="col" className="w-14 px-4 py-3.5">
                                    <span className="sr-only">Wybór</span>
                                </th>
                                <th scope="col" className="px-3 py-3.5 font-normal">Serial</th>
                                <th scope="col" className="px-3 py-3.5 font-normal">Odcinek</th>
                                <th scope="col" className="px-3 py-3.5 text-right font-normal">Rozmiar</th>
                                <th scope="col" className="px-4 py-3.5 text-right font-normal">Stan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => {
                                const id = entryId(entry);
                                const canRegister = entry.state === "new";
                                return (
                                    <tr key={id} className="border-b border-nx-border/60 transition-colors duration-140 last:border-0 hover:bg-nx-raised/50">
                                        <td className="px-4 py-3.5">
                                            {canRegister && (
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(id)}
                                                    onChange={() => toggle(entry)}
                                                    aria-label={`Zarejestruj ${entry.seriesKey} ${entry.episodeKey}`}
                                                    className="size-5 cursor-pointer rounded border-nx-border bg-nx-bg accent-nx-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent"
                                                />
                                            )}
                                        </td>
                                        <td className="max-w-52 truncate px-3 py-3.5 font-medium text-nx-text" title={entry.seriesKey}>
                                            {entry.seriesKey}
                                        </td>
                                        <td className="max-w-52 truncate px-3 py-3.5 font-mono text-xs text-nx-text-2" title={entry.episodeKey}>
                                            {entry.episodeKey}
                                        </td>
                                        <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums text-nx-text-2">
                                            {formatBytes(entry.sizeBytes)}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] ${STATE_CLASS[entry.state]}`}>
                                                {STATE_LABEL[entry.state]}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default LibraryScanPanel;
