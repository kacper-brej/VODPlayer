"use client";

import Image from "next/image";
import {
    Check,
    ExternalLink,
    ImageOff,
    LoaderCircle,
    RotateCcw,
    Search,
    SkipForward,
    Upload,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
    correctSeriesSeasonAction,
    refreshMetadataReviewAction,
    saveManualMatchAction,
    selectSeriesArtworkAction,
    setMetadataReviewDecisionAction,
    undoManualMetadataAction,
} from "@/lib/metadataReviewActions";
import { prepareSearchEntries, searchEntries } from "@/lib/search";
import { searchMetadataAction } from "@/lib/uploadWorkflowActions";
import type {
    MetadataArtworkKind,
    MetadataReviewItem,
    MetadataReviewReason,
    MetadataSearchOption,
} from "@/lib/uploadWorkflowTypes";
import { imageLoader } from "@/lib/imageDelivery";
import { cn } from "@/lib/utils";

const reasonLabels: Record<MetadataReviewReason, string> = {
    "no-match": "Żaden dostawca nie znalazł pewnego dopasowania",
    "partial-match": "Najlepsze dopasowanie jest poniżej progu pewności",
    "missing-tmdb": "Brakuje mapowania TMDB dla grafik lub kadrów",
    "uncertain-season": "Nie udało się pewnie ustalić numeru sezonu TMDB",
};

const kindLabels: Record<MetadataArtworkKind, string> = {
    poster: "Plakaty",
    backdrop: "Kadry poziome",
    logo: "Logotypy",
};

const errorMessage = (reason: string) => {
    if (reason === "unauthorized" || reason === "forbidden") return "Your session has expired. Sign in again.";
    if (reason === "network") return "The server is unavailable. Check the connection and try again.";
    if (reason === "invalid_response") return "The server returned an invalid response.";
    return "The operation could not be completed. Try again.";
};

const statusFor = (item: MetadataReviewItem) => {
    if (item.state === "skipped") return "Pominięty celowo";
    if (item.reason) return reasonLabels[item.reason];
    return "Metadane gotowe";
};

const MetadataReviewPanel = ({ initialItems }: { initialItems: MetadataReviewItem[] }) => {
    const sortedInitial = useMemo(() => [...initialItems].sort((left, right) =>
        Number(right.state === "pending") - Number(left.state === "pending")
        || left.title.localeCompare(right.title, "pl")
    ), [initialItems]);
    const [items, setItems] = useState(sortedInitial);
    const [selectedKey, setSelectedKey] = useState(sortedInitial.find((item) => item.state === "pending")?.seriesKey ?? sortedInitial[0]?.seriesKey ?? "");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<MetadataSearchOption[]>([]);
    const [directProvider, setDirectProvider] = useState<"anilist" | "tmdb">("anilist");
    const [directId, setDirectId] = useState("");
    const initialSelected = sortedInitial.find((item) => item.state === "pending") ?? sortedInitial[0] ?? null;
    const [season, setSeason] = useState(initialSelected?.seasonNumber ? String(initialSelected.seasonNumber) : "");
    const [isOpen, setIsOpen] = useState(initialItems.some((item) => item.state === "pending"));
    const [isBusy, setIsBusy] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const selected = items.find((item) => item.seriesKey === selectedKey) ?? items[0] ?? null;

    const pendingCount = items.filter((item) => item.state === "pending").length;
    const preparedResults = useMemo(() => prepareSearchEntries(results.map((item) => ({
        ...item,
        key: `${item.providerId}:${item.externalId}`,
    }))), [results]);
    const rankedResults = useMemo(() => searchEntries(preparedResults, query).map((result) => result.entry), [preparedResults, query]);
    const selectedBackdrop = selected?.artwork.find((item) => item.kind === "backdrop" && item.isPrimary)
        ?? selected?.artwork.find((item) => item.kind === "backdrop")
        ?? null;
    const hasManualChoice = selected
        ? Object.values(selected.externalIdSources).includes("manual") || selected.artwork.some((item) => item.matchSource === "manual" && item.isPrimary)
        : false;

    const reload = async (preferredKey = selectedKey) => {
        const refreshed = await refreshMetadataReviewAction();
        if (refreshed.kind === "error") throw new Error(errorMessage(refreshed.reason));
        const sorted = [...refreshed.data].sort((left, right) =>
            Number(right.state === "pending") - Number(left.state === "pending")
            || left.title.localeCompare(right.title, "pl")
        );
        setItems(sorted);
        const nextSelected = sorted.find((item) => item.seriesKey === preferredKey) ?? sorted[0] ?? null;
        setSelectedKey(nextSelected?.seriesKey ?? "");
        setSeason(nextSelected?.seasonNumber ? String(nextSelected.seasonNumber) : "");
    };

    const run = async (operation: () => Promise<void>, success: string) => {
        setIsBusy(true);
        setError(null);
        setNotice(null);
        try {
            await operation();
            setNotice(success);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "The operation could not be completed. Try again.");
        } finally {
            setIsBusy(false);
        }
    };

    const handleSearch = async (event: FormEvent) => {
        event.preventDefault();
        if (query.trim().length < 2) return;
        setIsSearching(true);
        setError(null);
        const response = await searchMetadataAction(query);
        setIsSearching(false);
        if (response.kind === "error") {
            setResults([]);
            setError(`${errorMessage(response.reason)} You can still use a direct provider ID below.`);
            return;
        }
        setResults(response.data);
    };

    const saveMatch = (provider: "anilist" | "tmdb" | "jikan", externalId: string) => {
        if (!selected) return;
        void run(async () => {
            const response = await saveManualMatchAction(selected.seriesKey, provider, externalId);
            if (response.kind === "error") throw new Error(errorMessage(response.reason));
            await reload(selected.seriesKey);
        }, "Ręczne dopasowanie zostało zapisane.");
    };

    const uploadArtwork = (file: File, kind: MetadataArtworkKind) => {
        if (!selected) return;
        void run(async () => {
            const formData = new FormData();
            formData.set("seriesKey", selected.seriesKey);
            formData.set("kind", kind);
            formData.set("file", file, file.name);
            const response = await fetch("/api/admin/artwork", { method: "POST", body: formData });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                const message = payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
                    ? (payload as { error: string }).error
                    : "The artwork could not be uploaded.";
                throw new Error(message);
            }
            await reload(selected.seriesKey);
        }, "Własna grafika została zapisana i ustawiona jako główna.");
    };

    if (items.length === 0) return null;

    return (
        <section className="mb-8 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
            <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((value) => !value)}
                className="flex min-h-16 w-full items-center justify-between gap-4 px-5 text-left hover:bg-surface-light/35 md:px-8"
            >
                <span>
                    <span className="font-display text-xl">Dopasowanie biblioteki</span>
                    <span className="mt-1 block text-sm text-muted">{pendingCount === 0 ? "Brak oczekujących decyzji" : `${pendingCount} ${pendingCount === 1 ? "serial wymaga" : "seriali wymaga"} decyzji`}</span>
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1 font-mono text-xs text-primary">{isOpen ? "Zwiń" : "Otwórz"}</span>
            </button>

            {isOpen && selected && (
                <div className="grid border-t border-border lg:grid-cols-[280px_1fr]">
                    <div className="max-h-[720px] overflow-y-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
                        {items.map((item) => (
                            <button
                                key={item.seriesKey}
                                type="button"
                                onClick={() => {
                                    setSelectedKey(item.seriesKey);
                                    setSeason(item.seasonNumber ? String(item.seasonNumber) : "");
                                    setError(null);
                                    setNotice(null);
                                }}
                                className={cn(
                                    "mb-2 min-h-16 w-full rounded-xl border px-3 py-2 text-left transition-colors",
                                    item.seriesKey === selected.seriesKey ? "border-primary bg-primary/10" : "border-transparent hover:bg-surface-light/50",
                                )}
                            >
                                <span className="block truncate text-sm font-semibold">{item.title}</span>
                                <span className={cn("mt-1 block text-xs", item.state === "pending" ? "text-warning" : "text-muted")}>{statusFor(item)}</span>
                            </button>
                        ))}
                    </div>

                    <div className="min-w-0 p-5 md:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">{selected.seriesKey}</p>
                                <h2 className="mt-2 font-display text-3xl">{selected.title}</h2>
                                <p className={cn("mt-2 text-sm", selected.state === "pending" ? "text-warning" : "text-muted")}>{statusFor(selected)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selected.state === "skipped" ? (
                                    <button type="button" disabled={isBusy} onClick={() => void run(async () => {
                                        const response = await setMetadataReviewDecisionAction(selected.seriesKey, "pending", selected.reason);
                                        if (response.kind === "error") throw new Error(errorMessage(response.reason));
                                        await reload(selected.seriesKey);
                                    }, "Serial wrócił do kolejki.")} className="min-h-11 rounded-xl border border-border px-4 text-sm hover:bg-surface-light disabled:opacity-50"><RotateCcw className="mr-2 inline" size={16} />Przywróć</button>
                                ) : (
                                    <button type="button" disabled={isBusy} onClick={() => void run(async () => {
                                        const response = await setMetadataReviewDecisionAction(selected.seriesKey, "skipped", selected.reason);
                                        if (response.kind === "error") throw new Error(errorMessage(response.reason));
                                        await reload(selected.seriesKey);
                                    }, "Serial oznaczono jako pominięty celowo.")} className="min-h-11 rounded-xl border border-border px-4 text-sm hover:bg-surface-light disabled:opacity-50"><SkipForward className="mr-2 inline" size={16} />Pomiń celowo</button>
                                )}
                                {hasManualChoice && <button type="button" disabled={isBusy} onClick={() => void run(async () => {
                                    const response = await undoManualMetadataAction(selected.seriesKey);
                                    if (response.kind === "error") throw new Error(errorMessage(response.reason));
                                    await reload(selected.seriesKey);
                                }, "Cofnięto ręczną decyzję. Serial wrócił do trybu automatycznego.")} className="min-h-11 rounded-xl border border-border px-4 text-sm hover:bg-surface-light disabled:opacity-50"><RotateCcw className="mr-2 inline" size={16} />Wróć do automatu</button>}
                            </div>
                        </div>

                        <div className="mt-7 grid gap-6 xl:grid-cols-2">
                            <div className="rounded-xl border border-border bg-background/30 p-4">
                                <h3 className="font-semibold">Wyszukaj dopasowanie</h3>
                                <form onSubmit={handleSearch} className="mt-4 flex gap-2">
                                    <label className="relative flex-1">
                                        <span className="sr-only">Tytuł serialu</span>
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
                                        <input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} maxLength={100} required placeholder="Tytuł lub synonim" className="h-11 w-full rounded-xl border border-border bg-surface-light pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
                                    </label>
                                    <button disabled={isSearching || isBusy} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-background disabled:opacity-50">{isSearching ? <LoaderCircle className="animate-spin" size={18} /> : "Szukaj"}</button>
                                </form>
                                <div className="mt-4 grid gap-2">
                                    {rankedResults.slice(0, 8).map((item) => (
                                        <button key={item.key} type="button" disabled={isBusy} onClick={() => saveMatch(item.providerId, item.externalId)} className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-surface-light/35 p-2 text-left hover:border-primary/60 disabled:opacity-50">
                                            <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-background">
                                                {item.coverImage ? <Image src={item.coverImage} alt="" fill sizes="56px" loader={imageLoader(item.coverImage, "poster")} className="object-cover" /> : <ImageOff className="absolute inset-0 m-auto text-muted" size={20} />}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="line-clamp-2 text-sm font-semibold">{item.title}</span>
                                                <span className="mt-1 block font-mono text-xs text-muted">{item.year ?? "—"} · {item.type ?? "?"}</span>
                                                <span className="mt-1 block text-xs text-primary">{item.providerId} #{item.externalId.replace(/^tv:/, "")}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-background/30 p-4">
                                <h3 className="font-semibold">Wpisz ID bezpośrednio</h3>
                                <p className="mt-2 text-sm text-muted">Ta ścieżka pobiera rekord po ID i nie zależy od wyszukiwarki.</p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {(["anilist", "tmdb"] as const).map((provider) => <button key={provider} type="button" onClick={() => setDirectProvider(provider)} className={cn("min-h-11 rounded-xl border text-sm uppercase", directProvider === provider ? "border-primary bg-primary/10 text-primary" : "border-border")}>{provider}</button>)}
                                </div>
                                <form onSubmit={(event) => {
                                    event.preventDefault();
                                    if (/^\d+$/.test(directId.trim())) saveMatch(directProvider, directId.trim());
                                    else setError("Enter a numeric provider ID.");
                                }} className="mt-3 flex gap-2">
                                    <input value={directId} onChange={(event) => setDirectId(event.target.value)} inputMode="numeric" pattern="[0-9]+" required aria-label={`${directProvider} ID`} placeholder={`${directProvider === "anilist" ? "AniList" : "TMDB"} ID`} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-light px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
                                    <button disabled={isBusy} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-background disabled:opacity-50">Zapisz</button>
                                </form>
                                <a href={directProvider === "anilist" ? "https://anilist.co/search/anime" : "https://www.themoviedb.org/search/tv"} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-primary hover:underline">Znajdź ID w {directProvider === "anilist" ? "AniList" : "TMDB"}<ExternalLink size={15} /></a>

                                <div className="mt-5 border-t border-border pt-5">
                                    <h3 className="font-semibold">Numer sezonu TMDB</h3>
                                    <form onSubmit={(event) => {
                                        event.preventDefault();
                                        const number = Number(season);
                                        void run(async () => {
                                            const response = await correctSeriesSeasonAction(selected.seriesKey, selected.groupId, number);
                                            if (response.kind === "error") throw new Error(errorMessage(response.reason));
                                            await reload(selected.seriesKey);
                                        }, "Numer sezonu zapisano, a kadry odświeżono tylko dla tego serialu.");
                                    }} className="mt-3 flex gap-2">
                                        <input type="number" min={1} max={999} value={season} onChange={(event) => setSeason(event.target.value)} required aria-label="Numer sezonu TMDB" className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface-light px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
                                        <button disabled={isBusy || !selected.externalIds.tmdb} className="min-h-11 rounded-xl border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-40">Zapisz i odśwież kadry</button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        {selectedBackdrop && (
                            <div className="relative mt-7 aspect-[16/7] overflow-hidden rounded-2xl border border-border bg-background">
                                <Image src={selectedBackdrop.url} alt={`Podgląd hero: ${selected.title}`} fill sizes="(max-width: 1280px) 100vw, 900px" loader={imageLoader(selectedBackdrop.url, "hero")} className="object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/35 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-5 md:p-8">
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Podgląd hero</p>
                                    <h3 className="mt-2 max-w-[65%] font-display text-2xl md:text-4xl">{selected.title}</h3>
                                    <p className="mt-2 max-w-[55%] text-sm text-muted">Sprawdź czy tytuł pozostaje czytelny i nie zasłania najważniejszej części kadru.</p>
                                </div>
                            </div>
                        )}

                        <div className="mt-7 space-y-7">
                            {(["poster", "backdrop", "logo"] as MetadataArtworkKind[]).map((kind) => {
                                const artwork = selected.artwork.filter((item) => item.kind === kind);
                                return (
                                    <section key={kind}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <h3 className="font-semibold">{kindLabels[kind]}</h3>
                                            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 text-sm hover:bg-surface-light">
                                                <Upload size={16} />Wgraj własną
                                                <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(event) => {
                                                    const file = event.target.files?.[0];
                                                    if (file) uploadArtwork(file, kind);
                                                    event.target.value = "";
                                                }} />
                                            </label>
                                        </div>
                                        {artwork.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted">Brak zapisanych kandydatów.</p> : (
                                            <div className={cn("mt-3 grid gap-3", kind === "poster" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-2 xl:grid-cols-3")}>
                                                {artwork.map((item) => (
                                                    <button key={item.id} type="button" disabled={isBusy} onClick={() => void run(async () => {
                                                        const response = await selectSeriesArtworkAction(selected.seriesKey, item.id);
                                                        if (response.kind === "error") throw new Error(errorMessage(response.reason));
                                                        await reload(selected.seriesKey);
                                                    }, "Wybrano nową grafikę główną.")} className={cn("group overflow-hidden rounded-xl border bg-background text-left disabled:opacity-50", item.isPrimary ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50")}>
                                                        <span className={cn("relative block", kind === "poster" ? "aspect-[2/3]" : "aspect-video")}>
                                                            <Image src={item.url} alt={`${kindLabels[kind]} ${selected.title}`} fill sizes={kind === "poster" ? "180px" : "360px"} loader={imageLoader(item.url, kind === "poster" ? "poster" : "catalog")} className={cn("object-cover", kind === "logo" && "object-contain p-3")} />
                                                            {item.isPrimary && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-background"><Check size={11} />Główna</span>}
                                                        </span>
                                                        <span className="flex items-center justify-between gap-2 px-3 py-2 text-xs"><span className="truncate uppercase text-muted">{item.provider}</span><span className={item.matchSource === "manual" ? "text-primary" : "text-muted"}>{item.matchSource === "manual" ? "ręczna" : "auto"}</span></span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>

                        {isBusy && <p className="mt-6 flex items-center gap-2 text-sm text-muted" aria-live="polite"><LoaderCircle className="animate-spin" size={17} />Zapisywanie zmian…</p>}
                        {error && <p className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger" role="alert">{error}</p>}
                        {notice && <p className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground" aria-live="polite">{notice}</p>}
                    </div>
                </div>
            )}
        </section>
    );
};

export default MetadataReviewPanel;
