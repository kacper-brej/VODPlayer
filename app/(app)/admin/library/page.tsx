import { ChevronDown } from "lucide-react";
import { DataErrorState, DataState } from "@/components/data/DataState";
import { getAdminLibraryAction } from "@/lib/admin/adminActions";
import SeriesVisibilityControl from "@/components/admin/SeriesVisibilityControl";

const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const pluralize = (count: number, one: string, few: string, many: string): string => {
    if (count === 1) return one;
    if (count % 100 >= 12 && count % 100 <= 14) return many;
    if (count % 10 >= 2 && count % 10 <= 4) return few;
    return many;
};

const AdminLibraryPage = async () => {
    const result = await getAdminLibraryAction();

    if (result.kind === "error") {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
                <DataErrorState reason={result.reason} headingLevel={1} />
            </div>
        );
    }

    const series = result.data.series;
    const totalEpisodes = series.reduce((total, item) => total + item.episodeCount, 0);

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
            <div className="max-w-3xl">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                    Zasoby lokalne
                </p>
                <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">
                    Biblioteka
                </h1>
                <p className="mt-3 text-sm leading-6 text-nx-text-2 [font-variant-numeric:tabular-nums]">
                    Lokalnie: {series.length} {pluralize(series.length, "serial", "seriale", "seriali")} i{" "}
                    {totalEpisodes} {pluralize(totalEpisodes, "odcinek", "odcinki", "odcinków")}. Status migracji do
                    Backblaze B2 będzie dostępny po utworzeniu rejestru mediów.
                </p>
            </div>

            {series.length === 0 && (
                <DataState
                    kind="empty"
                    title="Biblioteka jest pusta"
                    description="Dodaj pierwszy materiał w zakładce „Wyślij plik”."
                />
            )}

            {series.length > 0 && (
                <div className="flex flex-col gap-3">
                    {series.map((item) => (
                        <details
                            key={item.seriesKey}
                            className="group overflow-hidden rounded-[var(--r-m)] border border-nx-border bg-nx-panel shadow-[var(--sh-2)]"
                        >
                            <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-[var(--r-m)] px-5 py-3 outline-none [&::-webkit-details-marker]:hidden sm:grid-cols-[20px_minmax(0,1fr)_auto] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent">
                                <ChevronDown
                                    size={18}
                                    aria-hidden="true"
                                    className="text-nx-text-2 transition-transform duration-[var(--dur-fast)] ease-[var(--ease)] group-open:rotate-180 motion-reduce:transition-none"
                                />
                                <span
                                    className="min-w-0 truncate text-sm font-semibold text-nx-text"
                                    title={item.seriesKey}
                                >
                                    {item.seriesKey}
                                </span>
                                <span className="col-start-2 font-mono text-[11px] text-nx-text-2 [font-variant-numeric:tabular-nums] sm:col-start-auto sm:text-xs">
                                    {item.episodeCount} odc. · {formatBytes(item.totalBytes)}
                                </span>
                            </summary>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-nx-border px-5 py-3">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-nx-text-2">
                                    Dostęp do materiału
                                </span>
                                <SeriesVisibilityControl seriesKey={item.seriesKey} visibility={item.visibility} />
                            </div>

                            <ul className="max-h-96 overflow-y-auto overscroll-contain border-t border-nx-border px-5">
                                {item.episodes.map((episode) => (
                                    <li
                                        key={episode.episodeKey}
                                        className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-nx-border/60 py-3 text-sm last:border-0"
                                    >
                                        <div className="min-w-0">
                                            <p
                                                className="truncate text-nx-text"
                                                title={episode.title ?? episode.episodeKey}
                                            >
                                                {episode.title ?? episode.episodeKey}
                                            </p>
                                            {episode.title && (
                                                <p
                                                    className="mt-1 truncate font-mono text-[10px] text-nx-text-2"
                                                    title={episode.episodeKey}
                                                >
                                                    {episode.episodeKey}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1 font-mono text-[11px] text-nx-text-2 [font-variant-numeric:tabular-nums] sm:flex-row sm:gap-3 sm:text-xs">
                                            {episode.durationSeconds !== null && (
                                                <span>{formatDuration(episode.durationSeconds)}</span>
                                            )}
                                            <span>{formatBytes(episode.sizeBytes)}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminLibraryPage;
