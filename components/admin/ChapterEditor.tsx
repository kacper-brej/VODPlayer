"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import type {
    AdminLibrarySeries,
    EpisodeChapter,
    EpisodeChapterType,
} from "@/lib/core/contracts";

const CHAPTER_TYPES: { value: EpisodeChapterType; label: string }[] = [
    { value: "intro", label: "Intro" },
    { value: "recap", label: "Recap" },
    { value: "outro", label: "Outro" },
];

const typeLabel = (type: EpisodeChapterType) =>
    CHAPTER_TYPES.find((item) => item.value === type)?.label ?? type;

const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;

    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
        : `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const isEpisodeChapter = (value: unknown): value is EpisodeChapter => {
    if (!value || typeof value !== "object") return false;
    const chapter = value as Record<string, unknown>;
    return (chapter.type === "intro" || chapter.type === "outro" || chapter.type === "recap")
        && typeof chapter.startSeconds === "number"
        && typeof chapter.endSeconds === "number";
};

const responseMessage = async (response: Response, fallback: string) => {
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    return typeof payload?.error === "string" ? payload.error : fallback;
};

const ChapterEditor = ({ series }: { series: AdminLibrarySeries[] }) => {
    const [seriesKey, setSeriesKey] = useState(series[0]?.seriesKey ?? "");
    const selectedSeries = useMemo(
        () => series.find((item) => item.seriesKey === seriesKey) ?? series[0] ?? null,
        [series, seriesKey],
    );
    const [episodeKey, setEpisodeKey] = useState(selectedSeries?.episodes[0]?.episodeKey ?? "");
    const selectedEpisode = selectedSeries?.episodes.find((item) => item.episodeKey === episodeKey)
        ?? selectedSeries?.episodes[0]
        ?? null;
    const [chapters, setChapters] = useState<EpisodeChapter[]>([]);
    const [chapterType, setChapterType] = useState<EpisodeChapterType>("intro");
    const [startSeconds, setStartSeconds] = useState("0");
    const [endSeconds, setEndSeconds] = useState("90");
    const [applyToSeries, setApplyToSeries] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        if (!selectedSeries || !selectedEpisode) return;

        const controller = new AbortController();
        const params = new URLSearchParams({
            series: selectedSeries.seriesKey,
            episode: selectedEpisode.episodeKey,
        });

        fetch(`/api/chapters?${params.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
        }).then(async (response) => {
            if (!response.ok) throw new Error(await responseMessage(response, "Nie udało się wczytać rozdziałów."));
            const payload: unknown = await response.json();
            if (!Array.isArray(payload) || !payload.every(isEpisodeChapter)) {
                throw new Error("Serwer zwrócił nieprawidłowe dane rozdziałów.");
            }
            setChapters(payload);
        }).catch((requestError: unknown) => {
            if (requestError instanceof DOMException && requestError.name === "AbortError") return;
            setError(requestError instanceof Error ? requestError.message : "Nie udało się wczytać rozdziałów.");
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });

        return () => controller.abort();
    }, [selectedEpisode, selectedSeries, reloadToken]);

    const selectSeries = (nextSeriesKey: string) => {
        const nextSeries = series.find((item) => item.seriesKey === nextSeriesKey) ?? null;
        setSeriesKey(nextSeriesKey);
        setEpisodeKey(nextSeries?.episodes[0]?.episodeKey ?? "");
        setLoading(true);
        setMessage(null);
        setError(null);
    };

    const selectEpisode = (nextEpisodeKey: string) => {
        setEpisodeKey(nextEpisodeKey);
        setLoading(true);
        setMessage(null);
        setError(null);
    };

    const saveChapter = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!selectedSeries || !selectedEpisode) return;

        const start = Number(startSeconds);
        const end = Number(endSeconds);
        setSaving(true);
        setMessage(null);
        setError(null);

        try {
            const response = await fetch("/api/chapters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    series: selectedSeries.seriesKey,
                    episode: selectedEpisode.episodeKey,
                    type: chapterType,
                    startSeconds: start,
                    endSeconds: end,
                    applyToSeries,
                }),
            });
            if (!response.ok) throw new Error(await responseMessage(response, "Nie udało się zapisać rozdziału."));
            const payload = await response.json() as { affectedEpisodes?: unknown };
            const affected = typeof payload.affectedEpisodes === "number" ? payload.affectedEpisodes : 1;
            setMessage(`Zapisano zakres dla ${affected} ${affected === 1 ? "odcinka" : "odcinków"}.`);
            setLoading(true);
            setReloadToken((value) => value + 1);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Nie udało się zapisać rozdziału.");
        } finally {
            setSaving(false);
        }
    };

    const deleteChapter = async (type: EpisodeChapterType) => {
        if (!selectedSeries || !selectedEpisode) return;
        setSaving(true);
        setMessage(null);
        setError(null);
        const params = new URLSearchParams({
            series: selectedSeries.seriesKey,
            episode: selectedEpisode.episodeKey,
            type,
        });

        try {
            const response = await fetch(`/api/chapters?${params.toString()}`, { method: "DELETE" });
            if (!response.ok) throw new Error(await responseMessage(response, "Nie udało się usunąć rozdziału."));
            setMessage(`Usunięto ${typeLabel(type).toLocaleLowerCase("pl-PL")} z wybranego odcinka.`);
            setLoading(true);
            setReloadToken((value) => value + 1);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Nie udało się usunąć rozdziału.");
        } finally {
            setSaving(false);
        }
    };

    const editChapter = (chapter: EpisodeChapter) => {
        setChapterType(chapter.type);
        setStartSeconds(String(chapter.startSeconds));
        setEndSeconds(String(chapter.endSeconds));
        setMessage(null);
        setError(null);
    };

    const duration = selectedEpisode?.durationSeconds ?? null;

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <section className="rounded-[var(--r-m)] border border-nx-border bg-nx-panel p-5 shadow-[var(--sh-2)]" aria-labelledby="chapter-target-heading">
                <h2 id="chapter-target-heading" className="font-display text-[24px] leading-none tracking-[-0.02em] text-nx-text">
                    Wybierz materiał
                </h2>
                <div className="mt-5 grid gap-4">
                    <label>
                        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-nx-text-2">Serial</span>
                        <select value={selectedSeries?.seriesKey ?? ""} onChange={(event) => selectSeries(event.target.value)} className="min-h-11 w-full cursor-pointer rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-3 text-sm text-nx-text outline-none transition-colors duration-140 hover:border-nx-accent hover:bg-nx-raised/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent">
                            {series.map((item) => <option key={item.seriesKey} value={item.seriesKey}>{item.seriesKey}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-nx-text-2">Odcinek</span>
                        <select value={selectedEpisode?.episodeKey ?? ""} onChange={(event) => selectEpisode(event.target.value)} className="min-h-11 w-full cursor-pointer rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-3 text-sm text-nx-text outline-none transition-colors duration-140 hover:border-nx-accent hover:bg-nx-raised/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent">
                            {selectedSeries?.episodes.map((episode) => (
                                <option key={episode.episodeKey} value={episode.episodeKey}>
                                    {episode.title ?? episode.episodeKey}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="mt-6 border-t border-nx-border pt-5">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-nx-text">Aktywne zakresy</h3>
                        {duration !== null && <span className="font-mono text-[10px] text-nx-text-2">CZAS {formatTime(duration)}</span>}
                    </div>
                    {loading ? (
                        <p className="mt-4 text-sm text-nx-text-2">Wczytywanie…</p>
                    ) : chapters.length === 0 ? (
                        <p className="mt-4 text-sm leading-6 text-nx-text-2">Brak zapisanych rozdziałów dla tego odcinka.</p>
                    ) : (
                        <ul className="mt-3 grid gap-2">
                            {chapters.map((chapter) => (
                                <li key={chapter.type} className="flex flex-wrap items-center gap-3 rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-3 py-3 transition-[border-color,background-color] duration-140 hover:border-nx-text-2/40 hover:bg-nx-raised/35">
                                    <button type="button" onClick={() => editChapter(chapter)} className="min-w-0 flex-1 cursor-pointer rounded-[var(--r-s)] text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent">
                                        <span className="block text-sm font-semibold text-nx-text">{typeLabel(chapter.type)}</span>
                                        <span className="mt-1 block font-mono text-[10px] text-nx-text-2">{formatTime(chapter.startSeconds)} - {formatTime(chapter.endSeconds)}</span>
                                    </button>
                                    <button type="button" onClick={() => deleteChapter(chapter.type)} disabled={saving} aria-label={`Usuń ${typeLabel(chapter.type)} z odcinka`} className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-nx-border text-nx-text-2 outline-none transition-colors duration-140 hover:border-danger/50 hover:bg-nx-critical/10 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-55">
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            <form onSubmit={saveChapter} className="rounded-[var(--r-m)] border border-nx-border bg-nx-panel p-5 shadow-[var(--sh-2)]">
                <h2 className="font-display text-[24px] leading-none tracking-[-0.02em] text-nx-text">Ustaw zakres</h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">Czasy podawaj jako pełne sekundy od początku odcinka.</p>

                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <label>
                        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-nx-text-2">Typ</span>
                        <select value={chapterType} onChange={(event) => setChapterType(event.target.value as EpisodeChapterType)} className="min-h-11 w-full cursor-pointer rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-3 text-sm text-nx-text outline-none transition-colors duration-140 hover:border-nx-accent hover:bg-nx-raised/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent">
                            {CHAPTER_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-nx-text-2">Początek</span>
                        <input type="number" min={0} max={duration ?? undefined} step={1} required value={startSeconds} onChange={(event) => setStartSeconds(event.target.value)} className="min-h-11 w-full rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-3 text-sm text-nx-text outline-none transition-colors duration-140 hover:border-nx-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent" />
                    </label>
                    <label>
                        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-nx-text-2">Koniec</span>
                        <input type="number" min={1} max={duration ?? undefined} step={1} required value={endSeconds} onChange={(event) => setEndSeconds(event.target.value)} className="min-h-11 w-full rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-3 text-sm text-nx-text outline-none transition-colors duration-140 hover:border-nx-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent" />
                    </label>
                </div>

                <label className="mt-5 flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--r-s)] border border-nx-border bg-nx-bg px-4 py-3 transition-[border-color,background-color] duration-140 hover:border-nx-accent/60 hover:bg-nx-raised/40 focus-within:border-nx-accent">
                    <input type="checkbox" checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-nx-border bg-nx-bg accent-nx-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent" />
                    <span>
                        <span className="block text-sm font-semibold text-nx-text">Zastosuj do całej serii</span>
                        <span className="mt-1 block text-xs leading-5 text-nx-text-2">Ustawi wartość domyślną i zachowa istniejące ręczne korekty odcinków.</span>
                    </span>
                </label>

                <button type="submit" disabled={saving || !selectedEpisode} className="mt-6 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-nx-accent px-6 text-sm font-semibold text-nx-on-accent outline-none transition-[filter,opacity] duration-140 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-wait disabled:opacity-55">
                    <Save size={17} aria-hidden="true" />
                    {saving ? "Zapisywanie…" : "Zapisz zakres"}
                </button>
                {message && <p role="status" aria-live="polite" className="mt-4 text-sm text-nx-text-2">{message}</p>}
                {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
            </form>
        </div>
    );
};

export default ChapterEditor;
