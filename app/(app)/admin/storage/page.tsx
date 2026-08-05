import { DataErrorState } from "@/components/data/DataState";
import EpisodeDeleteButton from "@/components/admin/EpisodeDeleteButton";
import { getMediaStorageStatus } from "@/lib/mediaStorageStatus";
import { getStorageUsageAction } from "@/lib/adminStorageActions";

const B2_FREE_TIER_STORAGE_GB = 10;
const STORAGE_HISTORY_DAYS_SHOWN = 14;

const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

const formatDayLabel = (isoDate: string): string => {
    const parsed = new Date(`${isoDate}T00:00:00`);
    return parsed.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
};

const AdminStoragePage = async () => {
    const [mediaStorageResult, usageResult] = await Promise.all([
        getMediaStorageStatus(),
        getStorageUsageAction(),
    ]);

    const readyAssets = mediaStorageResult.kind === "success"
        ? mediaStorageResult.data.assets.filter((asset) => asset.status === "ready")
        : [];
    const sortedAssets = [...readyAssets].sort((a, b) => (b.totalSizeBytes ?? 0) - (a.totalSizeBytes ?? 0));

    const currentTotalBytes = usageResult.kind === "success" ? usageResult.data.currentTotalBytes : null;
    const currentMonthAverageBytes = usageResult.kind === "success" ? usageResult.data.currentMonthAverageBytes : null;
    const history = usageResult.kind === "success" ? usageResult.data.history.slice(-STORAGE_HISTORY_DAYS_SHOWN) : [];
    const maxHistoryBytes = Math.max(1, ...history.map((entry) => entry.totalBytes));
    const freeTierBytes = B2_FREE_TIER_STORAGE_GB * 1024 ** 3;
    const freeTierUsedPercent = currentTotalBytes !== null
        ? Math.min(100, Math.round((currentTotalBytes / freeTierBytes) * 100))
        : null;

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
            <div className="max-w-3xl">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                    Magazyn
                </p>
                <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">
                    Magazyn B2
                </h1>
                <p className="mt-3 text-sm leading-6 text-nx-text-2">
                    Zużycie Backblaze B2 i usuwanie przetranskodowanych odcinków (segmenty HLS + podgląd w B2
                    oraz plik źródłowy na serwerze).
                </p>
            </div>

            {usageResult.kind === "error" && (
                <section aria-label="Błąd danych zużycia magazynu">
                    <DataErrorState reason={usageResult.reason} compact />
                </section>
            )}

            {currentTotalBytes !== null && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <article className="min-w-0 rounded-[var(--r-m)] border border-nx-border bg-nx-panel px-5 py-5 shadow-[var(--sh-2)]">
                        <p className="min-h-7 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-text-2">
                            Zużycie dzisiaj
                        </p>
                        <p className="mt-2 font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-none tracking-[-0.025em] text-nx-text [font-variant-numeric:tabular-nums]">
                            {formatBytes(currentTotalBytes)}
                        </p>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-nx-border">
                            <div
                                className={`h-full rounded-full ${(freeTierUsedPercent ?? 0) >= 90 ? "bg-nx-critical" : "bg-nx-accent"}`}
                                style={{ width: `${freeTierUsedPercent ?? 0}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-nx-text-2">
                            {freeTierUsedPercent}% darmowego limitu B2 ({B2_FREE_TIER_STORAGE_GB} GB)
                        </p>
                    </article>

                    <article className="min-w-0 rounded-[var(--r-m)] border border-nx-border bg-nx-panel px-5 py-5 shadow-[var(--sh-2)]">
                        <p className="min-h-7 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-text-2">
                            Średnia w tym miesiącu
                        </p>
                        <p className="mt-2 font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-none tracking-[-0.025em] text-nx-text [font-variant-numeric:tabular-nums]">
                            {currentMonthAverageBytes !== null ? formatBytes(currentMonthAverageBytes) : "—"}
                        </p>
                        <p className="mt-4 text-xs leading-5 text-nx-text-2">
                            Liczona z dziennych migawek zapisywanych przy każdym otwarciu tej strony —
                            tak jak Backblaze liczy koszt magazynu (średnia dobowa w miesiącu).
                        </p>
                    </article>
                </div>
            )}

            {history.length > 1 && (
                <div className="max-w-3xl">
                    <h2 className="font-display text-[20px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                        Ostatnie {STORAGE_HISTORY_DAYS_SHOWN} dni
                    </h2>
                    <div className="mt-4 flex h-32 items-end gap-1.5 rounded-[var(--r-m)] border border-nx-border bg-nx-panel p-4">
                        {history.map((entry) => (
                            <div
                                key={entry.date}
                                className="group/bar relative flex flex-1 flex-col items-center justify-end gap-1"
                                title={`${formatDayLabel(entry.date)}: ${formatBytes(entry.totalBytes)}`}
                            >
                                <div
                                    className="w-full rounded-t-sm bg-nx-accent transition-opacity duration-140 group-hover/bar:opacity-80"
                                    style={{ height: `${Math.max(4, (entry.totalBytes / maxHistoryBytes) * 100)}%` }}
                                />
                                <span className="font-mono text-[8px] tracking-[0.08em] text-nx-text-2">
                                    {formatDayLabel(entry.date)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="max-w-3xl">
                <h2 className="font-display text-[20px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                    Przetranskodowane odcinki ({sortedAssets.length})
                </h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">
                    Usunięcie kasuje segmenty HLS i podgląd z B2 oraz plik <code className="text-nx-text">.mp4</code>{" "}
                    z serwera. Nieodwracalne.
                </p>
            </div>

            {mediaStorageResult.kind === "error" && (
                <section aria-label="Błąd danych magazynu">
                    <DataErrorState reason={mediaStorageResult.reason} compact />
                </section>
            )}

            {sortedAssets.length > 0 && (
                <ul className="grid gap-2">
                    {sortedAssets.map((asset) => (
                        <li
                            key={`${asset.seriesKey}/${asset.episodeKey}`}
                            className="flex items-center justify-between gap-4 rounded-[var(--r-m)] border border-nx-border bg-nx-panel px-4 py-3"
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm text-nx-text">
                                    {asset.seriesKey}/{asset.episodeKey}
                                </span>
                                <span className="mt-0.5 block font-mono text-[10px] tracking-[0.08em] text-nx-text-2">
                                    {asset.totalSizeBytes !== null ? formatBytes(asset.totalSizeBytes) : "—"}
                                </span>
                            </span>
                            <EpisodeDeleteButton seriesKey={asset.seriesKey} episodeKey={asset.episodeKey} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AdminStoragePage;
