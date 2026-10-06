"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Circle, Film, ImageOff, Search, Scissors, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { autoFillTmdbAction, correctSeriesSeasonAction, refreshMetadataReviewAction, saveManualMatchAction, selectSeriesArtworkAction, setMetadataReviewDecisionAction, undoManualMetadataAction } from "@/lib/admin/metadataReviewActions";
import { adminErrorMessage, seasonUpdateMessage, type AdminMessage } from "@/lib/admin/adminMessages";
import { searchMetadataAction } from "@/lib/upload/uploadWorkflowActions";
import { prepareArtworkUpload } from "@/lib/artwork/prepareArtworkUpload";
import type { MetadataArtworkKind, MetadataReviewItem, MetadataReviewReason, MetadataSearchOption } from "@/lib/upload/uploadWorkflowTypes";
import { imageLoader } from "@/lib/catalog/imageDelivery";
import AdminFeedback from "@/components/admin/AdminFeedback";
import ArtworkChooser from "./ArtworkChooser";
import s from "@/components/admin/admin.module.css";

const reasons: Record<MetadataReviewReason, string> = {
    "no-match": "Wybierz tytuł z wyników wyszukiwania, aby pobrać opis i grafiki.",
    "partial-match": "Znaleziono podobne tytuły. Sprawdź rok i wybierz właściwy.",
    "missing-tmdb": "Połącz materiał z TMDB, aby pobrać plakat, baner i logo.",
    "uncertain-season": "Sprawdź numer sezonu w ustawieniach poniżej. Dzięki temu odcinki dostaną właściwe miniatury.",
    "missing-poster": "Brakuje plakatu. Wybierz go z dostępnych grafik lub wgraj własny.",
};
const statusFor = (item: MetadataReviewItem) => item.state === "skipped" ? "Odłożone na później" : item.state === "pending" ? "Do uzupełnienia" : "Dane uzupełnione";
const sortItems = (items: MetadataReviewItem[]) => [...items].sort((a, b) => Number(b.state === "pending") - Number(a.state === "pending") || a.title.localeCompare(b.title, "pl"));

function MaterialEditor({ selected, busy, setBusy, reload }: {
    selected: MetadataReviewItem;
    busy: boolean;
    setBusy: (value: boolean) => void;
    reload: () => Promise<void>;
}) {
    const [query, setQuery] = useState(selected.title);
    const [source, setSource] = useState<"tmdb" | "anime">("tmdb");
    const [results, setResults] = useState<MetadataSearchOption[]>([]);
    const [searched, setSearched] = useState("");
    const [searchError, setSearchError] = useState<string | null>(null);
    const [showSearch, setShowSearch] = useState(!selected.externalIds.tmdb);
    const [retry, setRetry] = useState(0);
    const [resultPage, setResultPage] = useState({ key: "", count: 10 });
    const [message, setMessage] = useState<{ text: string; tone: "error" | "success" | "info" } | null>(null);
    const [busyText, setBusyText] = useState("");
    const [season, setSeason] = useState(String(selected.seasonNumber ?? 1));
    const [directId, setDirectId] = useState("");
    const [directKind, setDirectKind] = useState("tv");
    const [confirmReset, setConfirmReset] = useState(false);
    const operationLock = useRef(false);
    const searchKey = `${source}:${query.trim()}:${retry}`;
    const visibleResults = resultPage.key === searchKey ? resultPage.count : 10;
    const searching = showSearch && query.trim().length >= 2 && searched !== searchKey;
    const isMovie = selected.externalIds.tmdb?.startsWith("movie:") ?? false;

    useEffect(() => {
        if (!showSearch || query.trim().length < 2) return;
        let active = true;
        const timer = setTimeout(async () => {
            try {
                const response = await searchMetadataAction(query, source);
                if (!active) return;
                setResults(response.kind === "error" ? [] : response.data);
                setSearchError(response.kind === "error" ? adminErrorMessage(response.reason) : null);
            } catch {
                if (active) { setResults([]); setSearchError("Wyszukiwanie nie działa. Spróbuj ponownie za chwilę."); }
            } finally {
                if (active) setSearched(searchKey);
            }
        }, 400);
        return () => { active = false; clearTimeout(timer); };
    }, [query, source, showSearch, searchKey]);

    const run = async (work: () => Promise<string | AdminMessage>, progress: string) => {
        if (operationLock.current) return;
        operationLock.current = true;
        setBusy(true);
        setBusyText(progress);
        setMessage(null);
        try {
            const text = await work();
            setMessage(typeof text === "string" ? { text, tone: "success" } : text);
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : adminErrorMessage("server"), tone: "error" });
        } finally {
            operationLock.current = false;
            setBusy(false);
        }
    };

    const refreshAfterSave = async () => {
        try { await reload(); }
        catch { throw new Error("Zmiana została zapisana, ale nie udało się odświeżyć podglądu. Odśwież stronę."); }
    };

    const saveMatch = (provider: MetadataSearchOption["providerId"], id: string) => void run(async () => {
        const response = await saveManualMatchAction(selected.seriesKey, provider, id);
        if (response.kind === "error") throw new Error(adminErrorMessage(response.reason));
        await refreshAfterSave();
        setShowSearch(false);
        return "Pobrano dane i dostępne grafiki. Sprawdź podgląd poniżej. Własne wybory grafik zostały zachowane.";
    }, "Pobieranie opisu i grafik…");

    const autoFill = () => void run(async () => {
        const response = await autoFillTmdbAction(selected.seriesKey);
        if (response.kind === "error") throw new Error(adminErrorMessage(response.reason));
        if (response.data.status !== "saved") {
            setShowSearch(true);
            setSource("tmdb");
            setQuery(selected.title);
            throw new Error(response.data.status === "choose" ? "Znaleziono kilka możliwych dopasowań. Wybierz właściwy tytuł poniżej." : "Nie znaleziono tego tytułu w TMDB. Spróbuj wpisać jego oryginalną nazwę.");
        }
        await refreshAfterSave();
        setShowSearch(false);
        return "Pobrano dane z TMDB i dobrano dostępne grafiki. Własne wybory zostały zachowane.";
    }, "Dopasowywanie tytułu i pobieranie grafik…");

    const upload = (file: File, kind: MetadataArtworkKind) => void run(async () => {
        const prepared = await prepareArtworkUpload(file, kind);
        setBusyText("Wysyłanie i zapisywanie zdjęcia…");
        const formData = new FormData();
        formData.set("seriesKey", selected.seriesKey);
        formData.set("kind", kind);
        formData.set("file", prepared);
        const response = await fetch("/api/admin/artwork", { method: "POST", body: formData });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(response.status === 413 ? "Serwer odrzucił wielkość pliku. Wybierz mniejszą wersję zdjęcia." : payload?.error ?? "Nie udało się wysłać zdjęcia. Spróbuj ponownie.");
        await refreshAfterSave();
        return "Zdjęcie zapisane. Jest już używane w serwisie.";
    }, "Przygotowywanie zdjęcia…");

    return <div className={s.editor} aria-busy={busy}>
        <div className={s.editorHeader}>
            <div><h2>{selected.title}</h2><p className={`${s.badge} mt-2`} data-ready={selected.state === "ready"}>{selected.state === "ready" ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}{statusFor(selected)}</p></div>
            <button type="button" className={s.button} disabled={busy} onClick={autoFill}><WandSparkles size={17} aria-hidden="true" />{selected.externalIds.tmdb ? "Odśwież z TMDB" : "Uzupełnij z TMDB"}</button>
        </div>
        {busy ? <AdminFeedback tone="busy">{busyText}</AdminFeedback> : message ? <AdminFeedback tone={message.tone}>{message.text}</AdminFeedback> : selected.reason && selected.state !== "skipped" ? <p className={s.muted}>{reasons[selected.reason]}</p> : null}

        <section className={s.section} aria-labelledby="metadata-match-heading">
            <div className={s.between}>
                <div className={s.stepHeading}><span className={s.stepNumber}>1</span><h3 id="metadata-match-heading">Dopasuj tytuł</h3></div>
                {selected.externalIds.tmdb && <button type="button" disabled={busy} className={s.quiet} onClick={() => setShowSearch(!showSearch)}>{showSearch ? "Zamknij wyszukiwanie" : "Zmień dopasowanie"}</button>}
            </div>
            {!showSearch && selected.externalIds.tmdb && <p className={s.muted}>Połączono z TMDB ({isMovie ? "film" : "serial"}). Opis i grafiki możesz pobrać przyciskiem powyżej.</p>}
            {!showSearch && !selected.externalIds.tmdb && <button type="button" className={s.secondary} onClick={() => setShowSearch(true)}>Znajdź grafiki w TMDB</button>}
            {showSearch && <div className={s.stack}>
                <form className={s.row} onSubmit={(event) => { event.preventDefault(); setRetry((value) => value + 1); }}>
                    <label className={s.search}><span className="sr-only">Tytuł filmu lub serialu w TMDB</span><Search size={17} aria-hidden="true" /><input className={s.input} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} placeholder="Wpisz tytuł filmu lub serialu" disabled={busy} /></label>
                    <button className={s.secondary} disabled={busy || searching || query.trim().length < 2}>Szukaj</button>
                </form>
                <div className={s.row} aria-label="Źródło danych">
                    <button type="button" className={s.kindButton} aria-pressed={source === "tmdb"} disabled={busy} onClick={() => setSource("tmdb")}>TMDB: filmy i seriale</button>
                    <button type="button" className={s.kindButton} aria-pressed={source === "anime"} disabled={busy} onClick={() => setSource("anime")}>AniList / MyAnimeList</button>
                </div>
                {searching ? <p role="status" className={s.muted}>Szukam pasujących tytułów…</p> : query.trim().length < 2 ? <p className={s.muted}>Wpisz co najmniej 2 znaki.</p> : searchError ? <AdminFeedback tone="error">{searchError}</AdminFeedback> : <>
                    {results.length === 0 && <p className={s.muted}>Brak wyników. Spróbuj oryginalnego tytułu lub innego źródła.</p>}
                    <div className={s.searchResults}>
                        {results.slice(0, visibleResults).map((item) => <button key={`${item.providerId}:${item.externalId}`} type="button" disabled={busy} className={s.result} onClick={() => saveMatch(item.providerId, item.externalId)}>
                            <span className={s.resultPoster}>{item.coverImage ? <Image src={item.coverImage} alt="" fill sizes="60px" loader={imageLoader(item.coverImage, "poster")} className="object-cover" /> : <ImageOff size={20} aria-hidden="true" />}</span>
                            <span><strong>{item.title}</strong><small>{item.year ?? "Rok nieznany"} · {item.type === "MOVIE" ? "Film" : item.type === "TV" ? "Serial" : item.type ?? "Anime"}</small><small className="!text-nx-accent">Wybierz i pobierz dane</small></span>
                        </button>)}
                    </div>
                    {results.length > visibleResults && <button type="button" className={s.secondary} disabled={busy} onClick={() => setResultPage({ key: searchKey, count: visibleResults + 10 })}>Pokaż kolejne wyniki ({results.length - visibleResults})</button>}
                </>}
            </div>}
        </section>

        <section className={s.section} aria-labelledby="metadata-artwork-heading">
            <div className={s.stepHeading}><span className={s.stepNumber}>2</span><h3 id="metadata-artwork-heading">Sprawdź grafiki</h3></div>
            <p className={s.muted}>Możesz zostawić dobrane grafiki. Żeby je zmienić, kliknij miniaturę i zatwierdź wybór.</p>
            <ArtworkChooser key={JSON.stringify(selected.artwork.map((art) => [art.id, art.isPrimary]))} item={selected} busy={busy} onUpload={upload} onSelect={(id, label) => void run(async () => {
                const response = await selectSeriesArtworkAction(selected.seriesKey, id);
                if (response.kind === "error") throw new Error(adminErrorMessage(response.reason));
                await refreshAfterSave();
                return `Zapisano wybraną grafikę (${label.toLowerCase()}). Zmiana jest już widoczna w serwisie.`;
            }, "Zapisywanie grafiki…")} />
        </section>

        <div className={s.section}>
            <div className={s.between}><div><h3>Pomijanie czołówki i napisów</h3><p className={s.description}>Ustaw dokładne momenty w odtwarzaczu, np. od 00:30 do 02:00.</p></div><Link className={s.secondary} href={`/admin/chapters?series=${encodeURIComponent(selected.seriesKey)}`}><Scissors size={16} aria-hidden="true" />Ustaw czasy</Link></div>
        </div>

        <details className={s.details} open={selected.reason === "uncertain-season" || undefined}>
            <summary>Zaawansowane: sezon, ręczne ID i dopasowanie</summary>
            <div className={s.stack}>
                {!isMovie && <form className={s.stack} onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                        const result = await correctSeriesSeasonAction(selected.seriesKey, selected.groupId, Number(season));
                        if (result.kind === "error") throw new Error(adminErrorMessage(result.reason));
                        await refreshAfterSave();
                        return seasonUpdateMessage(result.data);
                    }, "Pobieranie miniatur odcinków…");
                }}>
                    <label className={s.field}>Numer sezonu w TMDB<input type="number" className={s.input} min={1} max={999} required value={season} disabled={busy} onChange={(event) => setSeason(event.target.value)} /></label>
                    <p className={s.muted}>Jeśli miniatury odcinków pochodzą z innego sezonu, popraw jego numer.</p>
                    <div><button className={s.secondary} disabled={busy || !selected.externalIds.tmdb}>Zapisz sezon i pobierz miniatury</button></div>
                </form>}
                <form className={s.stack} onSubmit={(event) => { event.preventDefault(); saveMatch(directKind === "anilist" ? "anilist" : "tmdb", directKind === "anilist" ? directId : `${directKind}:${directId}`); }}>
                    <h3>Wpisz ID ręcznie</h3>
                    <p className={s.muted}>Numer znajdziesz w adresie strony tytułu w TMDB lub AniList.</p>
                    <div className={s.row}>
                        <label className={s.field}>Rodzaj<select className={s.input} value={directKind} disabled={busy} onChange={(event) => setDirectKind(event.target.value)}><option value="tv">Serial w TMDB</option><option value="movie">Film w TMDB</option><option value="anilist">Anime w AniList</option></select></label>
                        <label className={`${s.field} flex-1`}>ID tytułu<input className={s.input} inputMode="numeric" pattern="[0-9]+" required disabled={busy} value={directId} onChange={(event) => setDirectId(event.target.value)} placeholder="np. 1399" /></label>
                    </div>
                    <div><button className={s.secondary} disabled={busy}>Pobierz dane dla tego ID</button></div>
                </form>
                <div className={s.row}>
                    <button type="button" className={s.quiet} disabled={busy} onClick={() => void run(async () => {
                        const result = await setMetadataReviewDecisionAction(selected.seriesKey, selected.state === "skipped" ? "pending" : "skipped", selected.reason);
                        if (result.kind === "error") throw new Error(adminErrorMessage(result.reason));
                        await refreshAfterSave();
                        return selected.state === "skipped" ? "Materiał wrócił na listę do uzupełnienia." : "Odłożono uzupełnianie danych. Widoczność materiału w serwisie się nie zmieniła.";
                    }, "Zapisywanie…")}>{selected.state === "skipped" ? "Przywróć do uzupełnienia" : "Uzupełnię później"}</button>
                    <button type="button" className={s.quiet} disabled={busy} onClick={() => setConfirmReset(!confirmReset)}>Zresetuj ręczne dopasowanie</button>
                </div>
                {confirmReset && <div className={s.stack}><p className={s.muted}>Usuniesz ręcznie przypisane ID i wybory grafik. Aplikacja ponownie dopasuje tytuł. Ta czynność nie usuwa pliku wideo.</p><div className={s.row}><button type="button" className={s.danger} disabled={busy} onClick={() => void run(async () => {
                    const result = await undoManualMetadataAction(selected.seriesKey);
                    if (result.kind === "error") throw new Error(adminErrorMessage(result.reason));
                    await refreshAfterSave(); setConfirmReset(false); setShowSearch(true);
                    return "Zresetowano dopasowanie. Sprawdź tytuł i grafiki.";
                }, "Ponowne dopasowywanie…")}>Resetuj dopasowanie</button><button type="button" className={s.quiet} disabled={busy} onClick={() => setConfirmReset(false)}>Anuluj</button></div></div>}
            </div>
        </details>
    </div>;
}

export default function MetadataReviewPanel({ initialItems }: { initialItems: MetadataReviewItem[] }) {
    const [items, setItems] = useState(() => sortItems(initialItems));
    const [selectedKey, setSelectedKey] = useState(() => sortItems(initialItems)[0]?.seriesKey ?? "");
    const [filter, setFilter] = useState("");
    const [onlyPending, setOnlyPending] = useState(false);
    const [busy, setBusy] = useState(false);
    const selected = items.find((item) => item.seriesKey === selectedKey) ?? items[0];
    const pendingCount = items.filter((item) => item.state === "pending").length;
    const visible = useMemo(() => items.filter((item) => (!onlyPending || item.state === "pending") && item.title.toLocaleLowerCase("pl").includes(filter.toLocaleLowerCase("pl"))), [items, onlyPending, filter]);
    const reload = async () => {
        const result = await refreshMetadataReviewAction();
        if (result.kind === "error") throw new Error(adminErrorMessage(result.reason));
        setItems(sortItems(result.data));
    };

    if (!selected) return <div className={s.empty}><Film size={32} aria-hidden="true" /><h2>Dodaj pierwszy materiał</h2><p>Gdy plik wideo będzie gotowy, pojawi się tutaj. Dopasujesz do niego tytuł i pobierzesz grafiki z TMDB.</p></div>;
    return <section className={s.workspace} aria-label="Edycja materiałów">
        <aside className={s.queue}>
            <div className={s.queueHeader}>
                <div className={s.between}><h2 className="!text-base">Twoje materiały</h2><span className={s.muted}>{items.length}</span></div>
                <label className={s.search}><span className="sr-only">Filtruj bibliotekę</span><Search size={16} aria-hidden="true" /><input className={s.input} value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Znajdź materiał" /></label>
                <label className={s.check}><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} /><span className="text-xs">Do uzupełnienia ({pendingCount})</span></label>
            </div>
            <div className={s.queueList}>
                {visible.map((item) => {
                    const poster = item.artwork.find((image) => image.kind === "poster" && image.isPrimary);
                    return <button type="button" key={item.seriesKey} disabled={busy} aria-current={item.seriesKey === selected.seriesKey ? "true" : undefined} className={s.queueItem} onClick={() => setSelectedKey(item.seriesKey)}>
                        <span className={s.queuePoster}>{poster ? <Image src={poster.url} alt="" fill sizes="40px" loader={imageLoader(poster.url, "poster")} className="object-cover" /> : <Film size={18} aria-hidden="true" />}</span>
                        <span><strong>{item.title}</strong><small>{statusFor(item)}</small></span>
                    </button>;
                })}
                {visible.length === 0 && <p className="p-3 text-xs leading-5 text-nx-text-2">Brak materiałów pasujących do filtra.</p>}
            </div>
        </aside>
        <MaterialEditor key={selected.seriesKey} selected={selected} busy={busy} setBusy={setBusy} reload={reload} />
    </section>;
}
