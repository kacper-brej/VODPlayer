"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Pencil, Save, Trash2 } from "lucide-react";
import type { AdminLibrarySeries, EpisodeChapter, EpisodeChapterType } from "@/lib/core/contracts";
import { formatChapterTime, parseChapterTime } from "@/lib/chapters/chapterTime";
import AdminFeedback from "./AdminFeedback";
import s from "./admin.module.css";

const TYPES: { value: EpisodeChapterType; label: string; hint: string }[] = [
    { value: "intro", label: "Czołówka", hint: "W tym fragmencie widz zobaczy przycisk „Pomiń czołówkę”." },
    { value: "recap", label: "Przypomnienie", hint: "Zaznacz streszczenie wydarzeń z poprzedniego odcinka." },
    { value: "outro", label: "Napisy końcowe", hint: "Zaznacz fragment z napisami, który widz może pominąć." },
];
const labelFor = (type: EpisodeChapterType) => TYPES.find((item) => item.value === type)?.label ?? type;
const validChapter = (value: unknown): value is EpisodeChapter => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return TYPES.some((type) => type.value === item.type)
        && typeof item.startSeconds === "number" && Number.isFinite(item.startSeconds)
        && typeof item.endSeconds === "number" && Number.isFinite(item.endSeconds);
};
const responseMessage = async (response: Response, fallback: string) => {
    if (response.status === 401) return "Sesja wygasła. Zaloguj się ponownie, aby zapisać zmiany.";
    const data = await response.json().catch(() => null) as { error?: unknown } | null;
    return typeof data?.error === "string" ? data.error : fallback;
};

function EpisodeChapters({ series, episodeKey, onBusy }: { series: AdminLibrarySeries; episodeKey: string; onBusy: (busy: boolean) => void }) {
    const episode = series.episodes.find((item) => item.episodeKey === episodeKey)!;
    const [chapters, setChapters] = useState<EpisodeChapter[]>([]);
    const [type, setType] = useState<EpisodeChapterType>("intro");
    const [startTime, setStartTime] = useState("00:00");
    const [endTime, setEndTime] = useState("01:30");
    const [applyToSeries, setApplyToSeries] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);
    const [deleteType, setDeleteType] = useState<EpisodeChapterType | null>(null);
    const mutationLock = useRef(false);
    const initialTimesLoaded = useRef(false);
    const duration = episode.durationSeconds;
    const start = parseChapterTime(startTime);
    const end = parseChapterTime(endTime);
    const rangeValid = start !== null && end !== null && start < end && (duration === null || end <= duration);
    const existing = chapters.find((chapter) => chapter.type === type);

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ series: series.seriesKey, episode: episodeKey });
        fetch(`/api/chapters?${params}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error(await responseMessage(response, "Nie udało się wczytać zapisanych czasów. Spróbuj ponownie."));
            const data: unknown = await response.json();
            if (!Array.isArray(data) || !data.every(validChapter)) throw new Error("Nie udało się odczytać zapisanych czasów. Spróbuj ponownie.");
            if (!controller.signal.aborted) {
                setChapters(data); setLoadError(null);
                if (!initialTimesLoaded.current) {
                    const intro = data.find((chapter) => chapter.type === "intro");
                    if (intro) {
                        setStartTime(formatChapterTime(intro.startSeconds));
                        setEndTime(formatChapterTime(intro.endSeconds));
                    }
                    initialTimesLoaded.current = true;
                }
            }
        }).catch((reason: unknown) => {
            if (controller.signal.aborted) return;
            setLoadError(reason instanceof Error ? reason.message : "Nie udało się wczytać zapisanych czasów.");
        }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [series.seriesKey, episodeKey, reload]);

    const changeType = (next: EpisodeChapterType) => {
        setType(next);
        const saved = chapters.find((chapter) => chapter.type === next);
        setStartTime(formatChapterTime(saved?.startSeconds ?? 0));
        setEndTime(formatChapterTime(saved?.endSeconds ?? 90));
        setMessage(null); setError(null); setDeleteType(null);
    };

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (mutationLock.current || loading || loadError) return;
        setMessage(null); setError(null);
        if (start === null || end === null) { setError("Wpisz czas jako minuty:sekundy, np. 01:30. Dla dłuższego filmu możesz użyć 1:05:20."); return; }
        if (start >= end) { setError("Koniec musi wypadać po początku zaznaczonego fragmentu."); return; }
        if (duration !== null && end > duration) { setError(`Materiał kończy się o ${formatChapterTime(duration)}. Wpisz wcześniejszy koniec fragmentu.`); return; }
        if (chapters.some((chapter) => chapter.type !== type && start < chapter.endSeconds && chapter.startSeconds < end)) { setError("Ten fragment nachodzi na inny zapisany zakres. Zmień początek lub koniec."); return; }
        mutationLock.current = true; setSaving(true); onBusy(true);
        try {
            const response = await fetch("/api/chapters", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ series: series.seriesKey, episode: episodeKey, type, startSeconds: start, endSeconds: end, applyToSeries }),
            });
            if (!response.ok) throw new Error(await responseMessage(response, "Nie udało się zapisać czasu. Spróbuj ponownie."));
            setMessage(applyToSeries ? "Zapisano domyślne czasy dla serii. Ręczne poprawki w innych odcinkach zostały zachowane." : `Zapisano: ${labelFor(type).toLowerCase()}, ${formatChapterTime(start)} do ${formatChapterTime(end)}.`);
            setLoading(true); setReload((value) => value + 1);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zapisać czasu. Spróbuj ponownie."); }
        finally { mutationLock.current = false; setSaving(false); onBusy(false); }
    };

    const remove = async (chapterType: EpisodeChapterType) => {
        if (mutationLock.current) return;
        mutationLock.current = true; setSaving(true); onBusy(true); setError(null); setMessage(null);
        try {
            const params = new URLSearchParams({ series: series.seriesKey, episode: episodeKey, type: chapterType });
            const response = await fetch(`/api/chapters?${params}`, { method: "DELETE" });
            if (!response.ok) throw new Error(await responseMessage(response, "Nie udało się usunąć zakresu. Spróbuj ponownie."));
            setMessage("Usunięto indywidualne ustawienie tego odcinka. Jeśli seria ma domyślny zakres, zostanie użyty poniżej.");
            setDeleteType(null); setLoading(true); setReload((value) => value + 1);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się usunąć zakresu."); }
        finally { mutationLock.current = false; setSaving(false); onBusy(false); }
    };

    return <div className={s.stack}>
        <form className={s.chapterForm} onSubmit={save}>
            <div><h2>Co widz może pominąć?</h2><p className={s.description}>Przepisz czas widoczny w odtwarzaczu. Nie musisz przeliczać go na sekundy.</p></div>
            {loadError && <AdminFeedback tone="error">{loadError} <button type="button" className={s.quiet} onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Wczytaj ponownie</button></AdminFeedback>}
            <fieldset disabled={loading || saving || Boolean(loadError)} className={s.stack}>
                <legend className="sr-only">Rodzaj i czas pomijanego fragmentu</legend>
                <div className={s.typeChoices}>{TYPES.map((item) => <button type="button" key={item.value} aria-pressed={type === item.value} onClick={() => changeType(item.value)} className={s.typeChoice}>{item.label}</button>)}</div>
                <p className={s.muted}>{TYPES.find((item) => item.value === type)?.hint}</p>
                <div className={s.timeFields}>
                    <label className={s.field}>Początek<input className={s.input} type="text" inputMode="text" spellCheck={false} autoComplete="off" required value={startTime} onChange={(event) => setStartTime(event.target.value)} onBlur={() => { if (start !== null) setStartTime(formatChapterTime(start)); }} placeholder="00:30" aria-describedby="chapter-time-help" aria-invalid={start === null} /></label>
                    <label className={s.field}>Koniec<input className={s.input} type="text" inputMode="text" spellCheck={false} autoComplete="off" required value={endTime} onChange={(event) => setEndTime(event.target.value)} onBlur={() => { if (end !== null) setEndTime(formatChapterTime(end)); }} placeholder="02:00" aria-describedby="chapter-time-help" aria-invalid={end === null} /></label>
                </div>
                <p id="chapter-time-help" className={s.muted}>Minuty:sekundy, np. 01:30. Godzina filmu: 1:00:00 lub 60:00.</p>
                {rangeValid && <div className={s.stack}>
                    {duration !== null && duration > 0 && <div className={s.timeline} aria-hidden="true"><span style={{ left: `${start! / duration * 100}%`, width: `${(end! - start!) / duration * 100}%` }} /></div>}
                    <p className={s.muted}>Pomijany fragment: <span className="text-nx-text">{formatChapterTime(start!)} do {formatChapterTime(end!)}</span> ({formatChapterTime(end! - start!)}).</p>
                </div>}
                <label className={s.check}><input type="checkbox" checked={applyToSeries} onChange={(event) => setApplyToSeries(event.target.checked)} /><span>Użyj tych czasów dla całej serii<small>Dotyczy także kolejnych odcinków. Zachowa ręczne poprawki ustawione osobno.</small></span></label>
            </fieldset>
            <div className={s.between}><button className={s.button} disabled={saving || loading || Boolean(loadError)}><Save size={17} aria-hidden="true" />{saving ? "Zapisywanie…" : existing ? "Zapisz zmiany" : "Dodaj zakres"}</button>{duration !== null && <span className={s.muted}>Długość materiału: {formatChapterTime(duration)}</span>}</div>
            {error && <AdminFeedback tone="error">{error}</AdminFeedback>}
            {message && <AdminFeedback tone="success">{message}</AdminFeedback>}
        </form>
        <section aria-labelledby="saved-chapters"><h3 id="saved-chapters">Zapisane zakresy</h3>
            {loading ? <p role="status" className="mt-3 text-sm text-nx-text-2">Wczytywanie czasów…</p> : !loadError && chapters.length === 0 ? <p className="mt-3 text-sm text-nx-text-2">Jeszcze nic nie ustawiono. Dodaj pierwszy fragment powyżej.</p> : !loadError && <ul className={s.chapterList}>
                {chapters.map((chapter) => <li className={s.chapterRow} key={chapter.type}>
                    <button type="button" disabled={saving} onClick={() => changeType(chapter.type)} aria-label={`Edytuj: ${labelFor(chapter.type)}`}><strong>{labelFor(chapter.type)}</strong><span>{formatChapterTime(chapter.startSeconds)} do {formatChapterTime(chapter.endSeconds)}</span></button>
                    {deleteType === chapter.type ? <div className={s.row}><button type="button" className={s.danger} disabled={saving} onClick={() => void remove(chapter.type)}><Check size={15} aria-hidden="true" />Usuń</button><button type="button" className={s.quiet} disabled={saving} onClick={() => setDeleteType(null)}>Anuluj</button></div> : <><button type="button" className={s.quiet} disabled={saving} aria-label={`Zmień czas: ${labelFor(chapter.type)}`} onClick={() => changeType(chapter.type)}><Pencil size={16} aria-hidden="true" /></button><button type="button" className={s.quiet} disabled={saving} aria-label={`Usuń: ${labelFor(chapter.type)}`} onClick={() => setDeleteType(chapter.type)}><Trash2 size={16} aria-hidden="true" /></button></>}
                </li>)}
            </ul>}
        </section>
    </div>;
}

export default function ChapterEditor({ series, initialSeriesKey }: { series: AdminLibrarySeries[]; initialSeriesKey?: string }) {
    const [seriesKey, setSeriesKey] = useState(series.find((item) => item.seriesKey === initialSeriesKey)?.seriesKey ?? series[0]?.seriesKey ?? "");
    const selectedSeries = series.find((item) => item.seriesKey === seriesKey) ?? series[0];
    const [episodeKey, setEpisodeKey] = useState(selectedSeries?.episodes[0]?.episodeKey ?? "");
    const [busy, setBusy] = useState(false);
    const selectedEpisode = selectedSeries?.episodes.find((item) => item.episodeKey === episodeKey) ?? selectedSeries?.episodes[0];
    if (!selectedSeries || !selectedEpisode) return <p className={s.muted}>Dodaj materiał, aby ustawić pomijane fragmenty.</p>;
    return <div className={s.chapterLayout}>
        <section className={s.chapterTarget} aria-labelledby="chapter-target">
            <div><h2 id="chapter-target">Wybierz materiał</h2><p className={s.description}>Czasy zapiszesz dla wybranego filmu lub odcinka.</p></div>
            <label className={s.field}>Film lub serial<select className={s.input} disabled={busy} value={selectedSeries.seriesKey} onChange={(event) => {
                setSeriesKey(event.target.value);
                setEpisodeKey(series.find((item) => item.seriesKey === event.target.value)?.episodes[0]?.episodeKey ?? "");
            }}>{series.map((item) => <option key={item.seriesKey} value={item.seriesKey}>{item.seriesKey}</option>)}</select></label>
            <label className={s.field}>Odcinek lub plik<select className={s.input} disabled={busy} value={selectedEpisode.episodeKey} onChange={(event) => setEpisodeKey(event.target.value)}>{selectedSeries.episodes.map((item) => <option key={item.episodeKey} value={item.episodeKey}>{item.title ?? item.episodeKey}</option>)}</select></label>
            <p className={s.muted}>Każdy rodzaj fragmentu ma jeden zakres. Kliknij zapisany zakres, jeśli chcesz poprawić jego czas.</p>
        </section>
        <EpisodeChapters key={`${selectedSeries.seriesKey}/${selectedEpisode.episodeKey}`} series={selectedSeries} episodeKey={selectedEpisode.episodeKey} onBusy={setBusy} />
    </div>;
}
