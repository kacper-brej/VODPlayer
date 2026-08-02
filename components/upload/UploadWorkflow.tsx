"use client";

import Image from "next/image";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    FileVideo,
    ImageOff,
    LoaderCircle,
    RotateCcw,
    Search,
    TriangleAlert,
    UploadCloud,
    X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import getUploadTokenAction from "@/lib/getUploadTokenAction";
import {
    loadMetadataSelectionAction,
    refreshUploadCatalogAction,
    saveEpisodeTitleAction,
    saveIntroChapterAction,
    saveSeriesGroupingAction,
    saveSeriesMetadataAction,
    searchMetadataAction,
} from "@/lib/uploadWorkflowActions";
import type {
    MetadataProviderId,
    MetadataSearchOption,
    MetadataSelection,
    UploadChunkResponse,
    UploadWorkflowSetup,
} from "@/lib/uploadWorkflowTypes";
import { imageLoader } from "@/lib/imageDelivery";
import { cn } from "@/lib/utils";
import MetadataReviewPanel from "@/components/upload/MetadataReviewPanel";

const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_EPISODE_NUMBER = 9999;
const VOD_UPLOAD_URL = `${process.env.NEXT_PUBLIC_VOD_ORIGIN ?? "https://vids.kacper-brej.pl"}/upload.php`;

type Mode = "new" | "existing";
type GroupMode = "none" | "existing" | "new";

type QueueItem = {
    id: string;
    file: File;
    episodeNumber: number;
    title: string;
    titleTouched: boolean;
    allowOverwrite: boolean;
    uploaded: boolean;
    metadataSaved: boolean;
    chapterSaved: boolean;
    episodeKey: string | null;
    durationSeconds: number | null;
    error: string | null;
};

const steps = ["Miejsce", "Metadane", "Pliki", "Czołówka", "Podsumowanie"];

const isVideoFile = (file: File) => /^[^.]+\.mp4$/i.test(file.name);

const deriveEpisodeNumber = (fileName: string, fallback: number) => {
    const digits = fileName.replace(/\.[^.]+$/, "").match(/\d+/g);
    if (!digits) return fallback;
    const parsed = Number(digits[digits.length - 1]);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_EPISODE_NUMBER ? parsed : fallback;
};

const episodeFileName = (episodeNumber: number) => `${String(episodeNumber).padStart(2, "0")}.mp4`;

const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

const parseClock = (value: string) => {
    const match = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
};

const formatClock = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

const dataErrorMessage = (reason: string) => {
    if (reason === "unauthorized" || reason === "forbidden") return "Your session has expired. Sign in again.";
    if (reason === "network") return "The server is unavailable. Check the connection and try again.";
    if (reason === "invalid_response") return "The server returned an invalid response.";
    return "The operation could not be completed. Try again.";
};

const readUploadResponse = (value: unknown): UploadChunkResponse | null => {
    if (typeof value !== "object" || value === null) return null;
    const item = value as Partial<UploadChunkResponse>;

    if (
        item.success !== true
        || typeof item.episodeKey !== "string"
        || typeof item.chunkIndex !== "number"
        || typeof item.totalChunks !== "number"
        || typeof item.completed !== "boolean"
        || typeof item.metadataStatus !== "string"
        || (item.durationSeconds !== null && typeof item.durationSeconds !== "number")
    ) {
        return null;
    }

    return item as UploadChunkResponse;
};

function Input({ className, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            className={cn(
                "h-12 w-full rounded-xl border border-border bg-surface-light/60 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary/60 focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

function FieldError({ id, children }: { id: string; children?: string | null }) {
    if (!children) return null;
    return <p id={id} className="mt-2 text-sm text-danger">{children}</p>;
}

function StatusMark({ done, label }: { done: boolean; label: string }) {
    return (
        <span className={cn("inline-flex items-center gap-1.5 text-xs", done ? "text-foreground" : "text-muted")}>
            <span className={cn("grid size-4 place-items-center rounded-full border", done && "border-primary bg-primary text-background")}>
                {done && <Check size={11} strokeWidth={3} />}
            </span>
            {label}
        </span>
    );
}

const UploadWorkflow = ({ initialSetup }: { initialSetup: UploadWorkflowSetup }) => {
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<Mode>("new");
    const [selectedSeriesKey, setSelectedSeriesKey] = useState("");
    const [folder, setFolder] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MetadataSearchOption[]>([]);
    const [selection, setSelection] = useState<MetadataSelection | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingSelection, setIsLoadingSelection] = useState(false);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
    const [hasIntro, setHasIntro] = useState(true);
    const [introStart, setIntroStart] = useState("00:00");
    const [introLength, setIntroLength] = useState("01:30");
    const [applyIntroToSeries, setApplyIntroToSeries] = useState(true);
    const [groupMode, setGroupMode] = useState<GroupMode>("none");
    const [groupId, setGroupId] = useState("");
    const [newGroupTitle, setNewGroupTitle] = useState("");
    const [seasonNumber, setSeasonNumber] = useState("1");
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [seriesMetadataSaved, setSeriesMetadataSaved] = useState(false);
    const [groupingSaved, setGroupingSaved] = useState(false);
    const [catalogRefreshed, setCatalogRefreshed] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    const dragCounter = useRef(0);
    const rejectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const selectedSeries = useMemo(
        () => initialSetup.series.find((series) => series.key === selectedSeriesKey) ?? null,
        [initialSetup.series, selectedSeriesKey],
    );

    const episodeTitles = useMemo(
        () => new Map((selection?.episodes ?? []).map((episode) => [episode.number, episode.title ?? ""])),
        [selection],
    );

    const existingEpisodeKeys = useMemo(
        () => new Set(selectedSeries?.episodes.map((episode) => episode.key) ?? []),
        [selectedSeries],
    );

    const duplicateNumbers = useMemo(() => {
        const counts = new Map<number, number>();
        queue.forEach((item) => counts.set(item.episodeNumber, (counts.get(item.episodeNumber) ?? 0) + 1));
        return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([number]) => number));
    }, [queue]);

    const startSeconds = parseClock(introStart);
    const lengthSeconds = parseClock(introLength);
    const endSeconds = startSeconds !== null && lengthSeconds !== null ? startSeconds + lengthSeconds : null;

    const folderCollision = mode === "new" && initialSetup.series.some(
        (series) => series.key.toLocaleLowerCase("pl") === folder.trim().toLocaleLowerCase("pl"),
    );
    const targetLocked = queue.some((item) => item.uploaded);
    const introLocked = queue.some((item) => item.uploaded && item.chapterSaved);

    const showError = (message: string) => {
        setError(message);
        requestAnimationFrame(() => errorRef.current?.focus());
    };

    const clearOperationState = () => {
        setError(null);
        setResultMessage(null);
    };

    useEffect(() => {
        return () => {
            if (rejectedTimeoutRef.current) clearTimeout(rejectedTimeoutRef.current);
        };
    }, []);

    const flashRejectedMessage = (message: string) => {
        if (rejectedTimeoutRef.current) clearTimeout(rejectedTimeoutRef.current);
        setRejectedMessage(message);
        rejectedTimeoutRef.current = setTimeout(() => setRejectedMessage(null), 3500);
    };

    const loadSelection = async (providerId: MetadataProviderId, externalId: string, setDefaultFolder: boolean) => {
        setIsLoadingSelection(true);
        clearOperationState();
        const response = await loadMetadataSelectionAction(providerId, externalId);
        setIsLoadingSelection(false);

        if (response.kind === "error") {
            showError(dataErrorMessage(response.reason));
            return;
        }

        setSelection(response.data);
        const titles = new Map(response.data.episodes.map((episode) => [episode.number, episode.title ?? ""]));
        setQueue((items) => items.map((item) => item.titleTouched
            ? item
            : { ...item, title: titles.get(item.episodeNumber) ?? "" }));
        if (setDefaultFolder) setFolder(response.data.title);
    };

    const handleSeriesChange = async (key: string) => {
        setSelectedSeriesKey(key);
        setSelection(null);
        clearOperationState();
        const series = initialSetup.series.find((item) => item.key === key);

        if (series?.metadataProvider === "jikan" && series.externalId) {
            await loadSelection("jikan", String(series.externalId), false);
        }
    };

    const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSearching(true);
        clearOperationState();
        const response = await searchMetadataAction(searchQuery);
        setIsSearching(false);

        if (response.kind === "error") {
            setSearchResults([]);
            showError(dataErrorMessage(response.reason));
            return;
        }

        setSearchResults(response.data);
    };

    const addFiles = (files: FileList | File[]) => {
        const incoming = Array.from(files);
        const valid = incoming.filter(isVideoFile);
        const rejected = incoming.length - valid.length;

        setQueue((current) => [
            ...current,
            ...valid.map((file, index) => {
                const episodeNumber = deriveEpisodeNumber(file.name, current.length + index + 1);
                return {
                    id: crypto.randomUUID(),
                    file,
                    episodeNumber,
                    title: episodeTitles.get(episodeNumber) ?? "",
                    titleTouched: false,
                    allowOverwrite: false,
                    uploaded: false,
                    metadataSaved: false,
                    chapterSaved: !hasIntro,
                    episodeKey: null,
                    durationSeconds: null,
                    error: null,
                };
            }),
        ]);

        if (rejected > 0) flashRejectedMessage(`Skipped unsupported files (${rejected}). Only MP4 is allowed.`);
    };

    const updateQueueItem = (id: string, change: Partial<QueueItem>) => {
        setQueue((items) => items.map((item) => item.id === id ? { ...item, ...change } : item));
    };

    const changeEpisodeNumber = (item: QueueItem, value: string) => {
        const number = Number(value);
        updateQueueItem(item.id, {
            episodeNumber: number,
            title: item.titleTouched ? item.title : episodeTitles.get(number) ?? "",
            allowOverwrite: false,
            metadataSaved: false,
            chapterSaved: !hasIntro,
            error: null,
        });
    };

    const validateStep = (targetStep: number) => {
        clearOperationState();

        if (step === 1 && mode === "existing" && !selectedSeries) {
            showError("Select an existing series before continuing.");
            return false;
        }

        if (step === 2) {
            if (mode === "new" && !selection) {
                showError("Select one search result before continuing.");
                return false;
            }
            if (mode === "new" && (folder.trim() === "" || folder.length > 255)) {
                showError("Enter a valid destination folder name.");
                return false;
            }
            if (folderCollision) {
                showError("This folder already exists. Choose the existing-series mode instead.");
                return false;
            }
            if (groupMode !== "none") {
                const parsedSeason = Number(seasonNumber);
                if (!Number.isInteger(parsedSeason) || parsedSeason < 1 || parsedSeason > 999) {
                    showError("Season number must be between 1 and 999.");
                    return false;
                }
                if (groupMode === "existing" && !groupId) {
                    showError("Select a series group.");
                    return false;
                }
                if (groupMode === "new" && !newGroupTitle.trim()) {
                    showError("Enter a name for the new series group.");
                    return false;
                }
            }
        }

        if (step === 3) {
            if (queue.length === 0) {
                showError("Add at least one MP4 file.");
                return false;
            }
            if (queue.some((item) => !Number.isInteger(item.episodeNumber) || item.episodeNumber < 1 || item.episodeNumber > MAX_EPISODE_NUMBER)) {
                showError("Every episode number must be between 1 and 9999.");
                return false;
            }
            if (duplicateNumbers.size > 0) {
                showError("Episode numbers in the queue must be unique.");
                return false;
            }
            if (mode === "existing" && queue.some((item) => existingEpisodeKeys.has(episodeFileName(item.episodeNumber)) && !item.allowOverwrite)) {
                showError("Confirm every existing episode that should be overwritten.");
                return false;
            }
        }

        if (step === 4 && hasIntro) {
            if (startSeconds === null || lengthSeconds === null || lengthSeconds <= 0 || endSeconds === null) {
                showError("Use mm:ss and enter an intro length greater than zero.");
                return false;
            }

            const knownDurations = queue.map((item) => {
                const key = episodeFileName(item.episodeNumber);
                return item.durationSeconds ?? selectedSeries?.episodes.find((episode) => episode.key === key)?.durationSeconds ?? null;
            });

            if (knownDurations.some((duration) => duration !== null && endSeconds > duration)) {
                showError("The intro end exceeds the known duration of at least one episode.");
                return false;
            }
        }

        setStep(targetStep);
        return true;
    };

    const requestUploadToken = async (seriesKey: string, item: QueueItem) => {
        const result = await getUploadTokenAction(seriesKey, item.episodeNumber, item.allowOverwrite);
        if (result.kind === "error") throw new Error(dataErrorMessage(result.reason));
        if (result.data.targetFolder !== seriesKey) throw new Error("The server changed the destination folder.");
        return result.data.token;
    };

    const uploadFileChunks = async (
        item: QueueItem,
        seriesKey: string,
        fileIndex: number,
    ): Promise<UploadChunkResponse> => {
        const totalChunks = Math.max(1, Math.ceil(item.file.size / CHUNK_SIZE));
        let token = await requestUploadToken(seriesKey, item);
        let finalResponse: UploadChunkResponse | null = null;

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, item.file.size);
            const chunk = item.file.slice(start, end);

            const sendChunk = (currentToken: string) => {
                const formData = new FormData();
                formData.append("token", currentToken);
                formData.append("folder", seriesKey);
                formData.append("episodeNumber", item.episodeNumber.toString());
                formData.append("filename", item.file.name);
                formData.append("chunkIndex", chunkIndex.toString());
                formData.append("totalChunks", totalChunks.toString());
                formData.append("file", chunk);
                return fetch(VOD_UPLOAD_URL, { method: "POST", body: formData });
            };

            let response = await sendChunk(token);
            if (response.status === 401) {
                token = await requestUploadToken(seriesKey, item);
                response = await sendChunk(token);
            }

            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                const message = typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
                    ? (payload as { error: string }).error
                    : `Chunk ${chunkIndex + 1} could not be uploaded.`;
                throw new Error(message);
            }

            finalResponse = readUploadResponse(payload);
            if (!finalResponse) throw new Error("The upload server returned an invalid response.");

            const fileProgress = (chunkIndex + 1) / totalChunks;
            setProgress(Math.round(((fileIndex + fileProgress) / queue.length) * 100));
        }

        if (!finalResponse?.completed) throw new Error("The upload was not completed by the server.");
        return finalResponse;
    };

    const handleUpload = async () => {
        if (isUploading) return;
        clearOperationState();
        setIsUploading(true);
        setProgress(0);

        const seriesKey = mode === "existing" ? selectedSeriesKey : folder.trim();
        const working: QueueItem[] = queue.map((item) => ({ ...item, error: null }));
        let metadataReady = mode === "existing" || seriesMetadataSaved;
        let groupReady = mode === "existing" || groupMode === "none" || groupingSaved;
        let seriesIntroReady = !hasIntro || !applyIntroToSeries || working.some((item) => item.chapterSaved);

        const syncItem = (index: number, change: Partial<QueueItem>) => {
            working[index] = { ...working[index], ...change };
            setQueue(working.map((item) => ({ ...item })));
        };

        for (let index = 0; index < working.length; index++) {
            const item = working[index];
            setStatusText(`${item.file.name} · ${index + 1}/${working.length}`);

            try {
                if (!item.uploaded) {
                    syncItem(index, { error: null });
                    const response = await uploadFileChunks(item, seriesKey, index);
                    syncItem(index, {
                        uploaded: true,
                        episodeKey: response.episodeKey,
                        durationSeconds: response.durationSeconds,
                    });
                }

                const current = working[index];
                const episodeKey = current.episodeKey ?? episodeFileName(current.episodeNumber);

                if (mode === "new" && selection && !metadataReady) {
                    const metadata = await saveSeriesMetadataAction(seriesKey, selection.providerId, selection.externalId);
                    if (metadata.kind === "error") throw new Error(dataErrorMessage(metadata.reason));
                    metadataReady = true;
                    setSeriesMetadataSaved(true);
                }

                if (!current.metadataSaved) {
                    const titleResult = await saveEpisodeTitleAction(seriesKey, episodeKey, current.title);
                    if (titleResult.kind === "error") throw new Error(dataErrorMessage(titleResult.reason));
                    syncItem(index, { metadataSaved: true });
                }

                if (hasIntro && !working[index].chapterSaved) {
                    if (startSeconds === null || endSeconds === null) throw new Error("Intro range is invalid.");
                    const duration = working[index].durationSeconds;
                    if (duration !== null && endSeconds > duration) {
                        throw new Error("The intro end exceeds this episode duration.");
                    }

                    if (applyIntroToSeries && seriesIntroReady) {
                        syncItem(index, { chapterSaved: true });
                    } else {
                        const chapter = await saveIntroChapterAction(
                            seriesKey,
                            episodeKey,
                            startSeconds,
                            endSeconds,
                            applyIntroToSeries,
                        );
                        if (chapter.kind === "error") throw new Error(dataErrorMessage(chapter.reason));
                        syncItem(index, { chapterSaved: true });
                        if (applyIntroToSeries) seriesIntroReady = true;
                    }
                }
            } catch (reason) {
                syncItem(index, {
                    error: reason instanceof Error ? reason.message : "The operation failed.",
                });
            }
        }

        if (mode === "new" && groupMode !== "none" && !groupReady && working.some((item) => item.uploaded)) {
            setStatusText("Zapisywanie sezonu");
            const grouping = await saveSeriesGroupingAction(
                seriesKey,
                groupMode === "existing" ? Number(groupId) : null,
                groupMode === "new" ? newGroupTitle : null,
                Number(seasonNumber),
            );

            if (grouping.kind === "error") {
                showError(dataErrorMessage(grouping.reason));
            } else {
                groupReady = true;
                setGroupingSaved(true);
            }
        }

        const catalogResult = await refreshUploadCatalogAction();
        setCatalogRefreshed(catalogResult.kind !== "error");
        const allFilesComplete = working.every((item) => item.uploaded && item.metadataSaved && (!hasIntro || item.chapterSaved));
        const complete = allFilesComplete && metadataReady && groupReady && catalogResult.kind !== "error";

        setQueue(working);
        setIsUploading(false);
        setProgress(complete ? 100 : progress);
        setStatusText("");
        setResultMessage(complete
            ? "Wszystkie pliki i metadane zostały zapisane. Katalog został odświeżony."
            : "Pliki zapisane poprawnie pozostają na serwerze. Popraw błędy i ponów tylko brakujące kroki.");
    };

    const hasPartialState = queue.some((item) => item.uploaded || item.metadataSaved);
    const allComplete = queue.length > 0
        && queue.every((item) => item.uploaded && item.metadataSaved && (!hasIntro || item.chapterSaved))
        && (mode === "existing" || seriesMetadataSaved)
        && (mode === "existing" || groupMode === "none" || groupingSaved)
        && catalogRefreshed;

    if (initialSetup.unauthorized) {
        return (
            <main className="grid min-h-[70vh] place-items-center px-4">
                <div className="max-w-lg rounded-2xl border border-border bg-surface p-8 text-center">
                    <TriangleAlert className="mx-auto mb-4 text-warning" />
                    <h1 className="font-display text-3xl text-foreground">Brak autoryzacji</h1>
                    <p className="mt-3 text-muted">Zaloguj się ponownie, aby zarządzać biblioteką.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground md:px-8 md:py-16">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/15 via-surface/25 to-background" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-[42vh] w-[100vh] -translate-x-1/2 rounded-b-full bg-primary/15 blur-[100px]" />

            <div className="relative mx-auto w-full max-w-5xl">
                <MetadataReviewPanel initialItems={initialSetup.metadataReview} />
                <header className="mb-8 flex items-start gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                        <UploadCloud size={26} />
                    </div>
                    <div>
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Biblioteka właściciela</p>
                        <h1 className="mt-1 font-display text-3xl font-medium md:text-4xl">Wgrywanie i metadane</h1>
                        <p className="mt-2 max-w-2xl text-sm text-muted">Dodaj materiał, sprawdź dopasowanie i zapisz komplet danych bez ponownego wysyłania dużego pliku.</p>
                    </div>
                </header>

                <ol aria-label="Postęp formularza" className="mb-6 grid grid-cols-5 gap-1 rounded-2xl border border-border bg-surface/80 p-2">
                    {steps.map((label, index) => {
                        const number = index + 1;
                        return (
                            <li key={label}>
                                <button
                                    type="button"
                                    disabled={number > step || isUploading}
                                    onClick={() => number < step && setStep(number)}
                                    aria-current={number === step ? "step" : undefined}
                                    className={cn(
                                        "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-2 text-xs transition-colors md:text-sm",
                                        number === step && "bg-primary text-background",
                                        number < step && "text-foreground hover:bg-surface-light",
                                        number > step && "cursor-not-allowed text-muted/60",
                                    )}
                                >
                                    <span className="font-mono">{String(number).padStart(2, "0")}</span>
                                    <span className="hidden sm:inline">{label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-2xl md:p-8">
                    {initialSetup.unavailable && (
                        <div className="mb-6 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                            <TriangleAlert className="shrink-0" size={18} />
                            Nie udało się pobrać wszystkich danych pomocniczych. Możesz ponowić po odświeżeniu strony.
                        </div>
                    )}

                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ duration: 0.2 }}
                        >
                            {step === 1 && (
                                <div>
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Krok 1</p>
                                    <h2 className="mt-2 font-display text-2xl">Wybierz miejsce docelowe</h2>
                                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                                        {(["new", "existing"] as Mode[]).map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                disabled={targetLocked}
                                                onClick={() => {
                                                    setMode(option);
                                                    setSelection(null);
                                                    clearOperationState();
                                                }}
                                                className={cn(
                                                    "min-h-28 rounded-2xl border p-5 text-left transition-colors",
                                                    mode === option ? "border-primary bg-primary/10" : "border-border bg-surface-light/40 hover:border-border-hover",
                                                    targetLocked && "cursor-not-allowed opacity-60",
                                                )}
                                            >
                                                <span className="text-base font-semibold">{option === "new" ? "Nowy serial" : "Nowe odcinki istniejącego serialu"}</span>
                                                <span className="mt-2 block text-sm text-muted">
                                                    {option === "new" ? "Wybierzesz dopasowany wynik i utworzysz nowy folder." : "Wskażesz serial z katalogu bez ręcznego wpisywania klucza."}
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {mode === "existing" && (
                                        <div className="mt-6">
                                            <label htmlFor="existing-series" className="mb-2 block text-sm font-medium">Serial z katalogu</label>
                                            <select
                                                id="existing-series"
                                                value={selectedSeriesKey}
                                                disabled={targetLocked}
                                                onChange={(event) => void handleSeriesChange(event.target.value)}
                                                className="h-12 w-full rounded-xl border border-border bg-surface-light px-4 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                                            >
                                                <option value="">Wybierz serial</option>
                                                {initialSetup.series.map((series) => <option key={series.key} value={series.key}>{series.title}</option>)}
                                            </select>
                                            {isLoadingSelection && <p className="mt-2 flex items-center gap-2 text-sm text-muted"><LoaderCircle className="animate-spin" size={15} /> Pobieranie tytułów odcinków…</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 2 && (
                                <div>
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Krok 2</p>
                                    <h2 className="mt-2 font-display text-2xl">Sprawdź metadane</h2>

                                    {mode === "new" && !selection && (
                                        <>
                                            <form onSubmit={handleSearch} className="mt-6 flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                                    <Input
                                                        aria-label="Nazwa anime"
                                                        value={searchQuery}
                                                        onChange={(event) => setSearchQuery(event.target.value)}
                                                        minLength={2}
                                                        maxLength={100}
                                                        required
                                                        className="pl-11"
                                                        placeholder="Wpisz nazwę anime"
                                                    />
                                                </div>
                                                <button disabled={isSearching} className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-background disabled:opacity-50">
                                                    {isSearching ? <LoaderCircle className="animate-spin" /> : "Szukaj"}
                                                </button>
                                            </form>

                                            {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                                                <p className="mt-5 rounded-xl border border-border bg-surface-light/40 p-4 text-sm text-muted">Brak wyników albo wyszukiwanie nie zostało jeszcze uruchomione.</p>
                                            )}

                                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                {searchResults.map((item) => (
                                                    <button
                                                        key={`${item.providerId}-${item.externalId}`}
                                                        type="button"
                                                        disabled={isLoadingSelection}
                                                        onClick={() => void loadSelection(item.providerId, item.externalId, true)}
                                                        className="flex min-h-28 gap-4 rounded-xl border border-border bg-surface-light/40 p-3 text-left transition-colors hover:border-primary/60 disabled:opacity-50"
                                                    >
                                                        <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-background">
                                                            {item.coverImage ? <Image src={item.coverImage} alt="" fill sizes="64px" loader={imageLoader(item.coverImage, "poster")} className="object-cover" /> : <ImageOff className="absolute inset-0 m-auto text-muted" />}
                                                        </span>
                                                        <span className="min-w-0 py-1">
                                                            <span className="line-clamp-2 font-semibold">{item.title}</span>
                                                            <span className="mt-2 block font-mono text-xs text-muted">{item.year ?? "—"} · {item.type ?? "Nieznany typ"}</span>
                                                            <span className="mt-2 block text-xs text-primary">{item.providerId === "jikan" ? `MAL #${item.externalId}` : `AniList #${item.externalId}`}</span>
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {isLoadingSelection && (
                                        <div className="mt-6 flex min-h-40 items-center justify-center gap-3 rounded-xl border border-border bg-surface-light/30 text-muted">
                                            <LoaderCircle className="animate-spin" /> Pobieranie szczegółów i wszystkich stron odcinków…
                                        </div>
                                    )}

                                    {selection && !isLoadingSelection && (
                                        <div className="mt-6 space-y-6">
                                            <div className="grid overflow-hidden rounded-2xl border border-border bg-surface-light/35 md:grid-cols-[180px_1fr]">
                                                <div className="relative aspect-2/3 bg-background md:aspect-auto">
                                                    {selection.coverImage ? <Image src={selection.coverImage} alt={`Okładka ${selection.title}`} fill sizes="180px" loader={imageLoader(selection.coverImage, "poster")} className="object-cover" /> : <ImageOff className="absolute inset-0 m-auto text-muted" />}
                                                </div>
                                                <div className="p-5 md:p-6">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-mono text-xs text-primary">{selection.providerId === "jikan" ? `Jikan · MAL #${selection.externalId}` : `AniList #${selection.externalId}`}</p>
                                                            <h3 className="mt-2 font-display text-2xl">{selection.title}</h3>
                                                        </div>
                                                        {mode === "new" && <button type="button" disabled={targetLocked} onClick={() => setSelection(null)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-light disabled:cursor-not-allowed disabled:opacity-50">Zmień wybór</button>}
                                                    </div>
                                                    <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted">{selection.synopsis || "Brak opisu."}</p>
                                                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                                                        <div><dt className="text-muted">Rok</dt><dd className="mt-1">{selection.year ?? "—"}</dd></div>
                                                        <div><dt className="text-muted">Ocena</dt><dd className="mt-1">{selection.rating ?? "—"}</dd></div>
                                                        <div><dt className="text-muted">Wiek</dt><dd className="mt-1">{selection.ageRating ?? "—"}</dd></div>
                                                        <div><dt className="text-muted">Studio</dt><dd className="mt-1">{selection.studio ?? "—"}</dd></div>
                                                    </dl>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <p className="mb-2 text-sm font-medium">Okładka pionowa</p>
                                                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-background">
                                                        {selection.coverImage ? <Image src={selection.coverImage} alt="Podgląd okładki" fill sizes="(max-width: 768px) 100vw, 50vw" loader={imageLoader(selection.coverImage, "poster")} className="object-contain" /> : <ImageOff className="absolute inset-0 m-auto text-muted" />}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="mb-2 text-sm font-medium">Kadr poziomy</p>
                                                    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-background">
                                                        {selection.backdropImage ? <Image src={selection.backdropImage} alt="Podgląd kadru poziomego" fill sizes="(max-width: 768px) 100vw, 50vw" loader={imageLoader(selection.backdropImage, "catalog")} className="object-cover" /> : <div className="absolute inset-0 grid place-items-center text-sm text-muted"><ImageOff className="mb-2" />Brak kadru</div>}
                                                    </div>
                                                </div>
                                            </div>

                                            {mode === "new" && (
                                                <div className="grid gap-5 rounded-xl border border-border bg-background/30 p-5 md:grid-cols-2">
                                                    <div className="md:col-span-2">
                                                        <label htmlFor="folder" className="mb-2 block text-sm font-medium">Docelowa nazwa folderu</label>
                                                        <Input id="folder" value={folder} disabled={targetLocked} onChange={(event) => setFolder(event.target.value)} maxLength={255} aria-describedby="folder-error" />
                                                        <FieldError id="folder-error">{folderCollision ? "Taki folder już istnieje. Wybierz tryb istniejącego serialu." : null}</FieldError>
                                                    </div>
                                                    <div>
                                                        <label htmlFor="group-mode" className="mb-2 block text-sm font-medium">Powiązanie sezonu</label>
                                                        <select id="group-mode" value={groupMode} disabled={targetLocked} onChange={(event) => setGroupMode(event.target.value as GroupMode)} className="h-12 w-full rounded-xl border border-border bg-surface-light px-4 outline-none focus:border-primary disabled:opacity-50">
                                                            <option value="none">Bez grupy sezonów</option>
                                                            <option value="existing">Istniejąca grupa</option>
                                                            <option value="new">Nowa grupa</option>
                                                        </select>
                                                    </div>
                                                    {groupMode === "existing" && (
                                                        <div>
                                                            <label htmlFor="group" className="mb-2 block text-sm font-medium">Grupa serialu</label>
                                                            <select id="group" value={groupId} disabled={targetLocked} onChange={(event) => setGroupId(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-surface-light px-4 outline-none focus:border-primary disabled:opacity-50">
                                                                <option value="">Wybierz grupę</option>
                                                                {initialSetup.groups.map((group) => <option key={group.id} value={group.id}>{group.baseTitle}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                    {groupMode === "new" && (
                                                        <div>
                                                            <label htmlFor="new-group" className="mb-2 block text-sm font-medium">Nazwa grupy</label>
                                                            <Input id="new-group" value={newGroupTitle} disabled={targetLocked} onChange={(event) => setNewGroupTitle(event.target.value)} maxLength={255} placeholder="np. Tokyo Ghoul" />
                                                        </div>
                                                    )}
                                                    {groupMode !== "none" && (
                                                        <div>
                                                            <label htmlFor="season-number" className="mb-2 block text-sm font-medium">Numer sezonu</label>
                                                            <Input id="season-number" type="number" min={1} max={999} value={seasonNumber} disabled={targetLocked} onChange={(event) => setSeasonNumber(event.target.value)} />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {mode === "existing" && !selection && !isLoadingSelection && (
                                        <div className="mt-6 rounded-xl border border-border bg-surface-light/35 p-5">
                                            <p className="font-medium">{selectedSeries?.title}</p>
                                            <p className="mt-2 text-sm text-muted">Ten serial nie ma zapisanego identyfikatora metadanych. Tytuły odcinków możesz wpisać ręcznie w następnym kroku.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 3 && (
                                <div>
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Krok 3</p>
                                    <h2 className="mt-2 font-display text-2xl">Pliki i tytuły odcinków</h2>
                                    <p className="mt-2 text-sm text-muted">Numer pochodzi początkowo z nazwy pliku, ale możesz go poprawić. Tytuł pochodzi wyłącznie z wybranego dopasowania albo z tego pola.</p>

                                    <div
                                        onDragEnter={(event) => {
                                            event.preventDefault();
                                            dragCounter.current += 1;
                                            setIsDragging(true);
                                        }}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDragLeave={(event) => {
                                            event.preventDefault();
                                            dragCounter.current = Math.max(0, dragCounter.current - 1);
                                            if (dragCounter.current === 0) setIsDragging(false);
                                        }}
                                        onDrop={(event) => {
                                            event.preventDefault();
                                            dragCounter.current = 0;
                                            setIsDragging(false);
                                            addFiles(event.dataTransfer.files);
                                        }}
                                        onClick={() => fileInputRef.current?.click()}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                fileInputRef.current?.click();
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        className={cn(
                                            "mt-6 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center outline-none transition-[transform,border-color,background-color] focus-visible:ring-2 focus-visible:ring-primary/50",
                                            isDragging ? "scale-[1.01] border-primary bg-primary/10" : "border-border bg-surface-light/25 hover:border-border-hover",
                                        )}
                                    >
                                        <input ref={fileInputRef} type="file" accept="video/mp4,.mp4" multiple className="hidden" onChange={(event) => {
                                            if (event.target.files) addFiles(event.target.files);
                                            event.target.value = "";
                                        }} />
                                        <UploadCloud size={42} className={isDragging ? "text-primary" : "text-muted"} />
                                        <p className="mt-4 font-medium">{isDragging ? "Upuść pliki tutaj" : "Przeciągnij MP4 albo wybierz z dysku"}</p>
                                        <p className="mt-1 text-sm text-muted">Duże pliki nadal są wysyłane bezpośrednio do serwera PHP w kawałkach.</p>
                                    </div>

                                    {rejectedMessage && <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{rejectedMessage}</p>}

                                    <div className="mt-6 space-y-3">
                                        {queue.map((item) => {
                                            const targetKey = episodeFileName(item.episodeNumber);
                                            const conflict = mode === "existing" && existingEpisodeKeys.has(targetKey);
                                            const duplicate = duplicateNumbers.has(item.episodeNumber);

                                            return (
                                                <article key={item.id} className="rounded-xl border border-border bg-surface-light/35 p-4">
                                                    <div className="flex items-center gap-3">
                                                        <FileVideo className="shrink-0 text-primary" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-medium">{item.file.name}</p>
                                                            <p className="mt-1 font-mono text-xs text-muted">{formatFileSize(item.file.size)} · {targetKey}</p>
                                                        </div>
                                                        <button type="button" disabled={item.uploaded} onClick={() => setQueue((items) => items.filter((entry) => entry.id !== item.id))} aria-label={`Usuń ${item.file.name}`} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"><X size={18} /></button>
                                                    </div>

                                                    <div className="mt-4 grid gap-4 md:grid-cols-[150px_1fr]">
                                                        <div>
                                                            <label htmlFor={`number-${item.id}`} className="mb-2 block text-xs text-muted">Numer odcinka</label>
                                                            <Input id={`number-${item.id}`} type="number" min={1} max={MAX_EPISODE_NUMBER} value={item.episodeNumber || ""} disabled={item.uploaded} onChange={(event) => changeEpisodeNumber(item, event.target.value)} aria-invalid={duplicate} />
                                                            {duplicate && <p className="mt-1 text-xs text-danger">Numer powtarza się w kolejce.</p>}
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`title-${item.id}`} className="mb-2 block text-xs text-muted">Tytuł odcinka</label>
                                                            <Input id={`title-${item.id}`} value={item.title} maxLength={255} disabled={item.metadataSaved} onChange={(event) => updateQueueItem(item.id, { title: event.target.value, titleTouched: true, metadataSaved: false })} placeholder="Brak tytułu — możesz zostawić puste" />
                                                        </div>
                                                    </div>

                                                    {conflict && (
                                                        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 text-sm text-warning">
                                                            <input type="checkbox" checked={item.allowOverwrite} disabled={item.uploaded} onChange={(event) => updateQueueItem(item.id, { allowOverwrite: event.target.checked })} className="size-4 accent-primary" />
                                                            Odcinek {targetKey} istnieje — świadomie nadpisz plik
                                                        </label>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {step === 4 && (
                                <div>
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Krok 4</p>
                                    <h2 className="mt-2 font-display text-2xl">Zakres czołówki</h2>

                                    <label className="mt-6 flex min-h-14 cursor-pointer items-center justify-between rounded-xl border border-border bg-surface-light/35 px-4">
                                        <span><span className="block font-medium">Ten serial ma czołówkę</span><span className="mt-1 block text-sm text-muted">Wyłączenie pozostawi fallback odtwarzacza 0–90 s bez zapisu rekordu.</span></span>
                                        <input type="checkbox" checked={hasIntro} disabled={introLocked} onChange={(event) => {
                                            setHasIntro(event.target.checked);
                                            setQueue((items) => items.map((item) => ({ ...item, chapterSaved: !event.target.checked })));
                                        }} className="size-5 accent-primary" />
                                    </label>

                                    {hasIntro && (
                                        <div className="mt-5 grid gap-5 rounded-xl border border-border bg-background/30 p-5 md:grid-cols-3">
                                            <div>
                                                <label htmlFor="intro-start" className="mb-2 block text-sm font-medium">Początek</label>
                                                <Input id="intro-start" inputMode="numeric" value={introStart} disabled={introLocked} onChange={(event) => setIntroStart(event.target.value)} placeholder="00:00" aria-describedby="intro-hint" />
                                            </div>
                                            <div>
                                                <label htmlFor="intro-length" className="mb-2 block text-sm font-medium">Długość</label>
                                                <Input id="intro-length" inputMode="numeric" value={introLength} disabled={introLocked} onChange={(event) => setIntroLength(event.target.value)} placeholder="01:30" aria-describedby="intro-hint" />
                                            </div>
                                            <div className="rounded-xl border border-border bg-surface-light/50 p-4">
                                                <span className="text-sm text-muted">Wyliczony koniec</span>
                                                <strong className="mt-2 block font-mono text-xl text-primary">{endSeconds === null ? "—" : formatClock(endSeconds)}</strong>
                                            </div>
                                            <p id="intro-hint" className="text-xs text-muted md:col-span-3">Format mm:ss. Zakres jest sprawdzany ponownie po ustaleniu czasu trwania przesłanego pliku.</p>
                                            <label className="flex min-h-11 cursor-pointer items-center gap-3 md:col-span-3">
                                                <input type="checkbox" checked={applyIntroToSeries} disabled={introLocked} onChange={(event) => setApplyIntroToSeries(event.target.checked)} className="size-4 accent-primary" />
                                                <span className="text-sm">Zastosuj do całego serialu i przyszłych odcinków</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 5 && (
                                <div>
                                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Krok 5</p>
                                    <h2 className="mt-2 font-display text-2xl">Podsumowanie i wysyłanie</h2>

                                    <dl className="mt-6 grid gap-3 rounded-xl border border-border bg-surface-light/35 p-5 sm:grid-cols-2">
                                        <div><dt className="text-xs text-muted">Cel</dt><dd className="mt-1 font-medium">{mode === "existing" ? selectedSeriesKey : folder}</dd></div>
                                        <div><dt className="text-xs text-muted">Metadane</dt><dd className="mt-1 font-medium">{selection ? `${selection.title} · ${selection.providerId === "jikan" ? `MAL #${selection.externalId}` : `AniList #${selection.externalId}`}` : "Tytuły ręczne"}</dd></div>
                                        <div><dt className="text-xs text-muted">Pliki</dt><dd className="mt-1 font-medium">{queue.length}</dd></div>
                                        <div><dt className="text-xs text-muted">Czołówka</dt><dd className="mt-1 font-medium">{hasIntro && startSeconds !== null && endSeconds !== null ? `${formatClock(startSeconds)}–${formatClock(endSeconds)}` : "Fallback 00:00–01:30"}</dd></div>
                                    </dl>

                                    <div className="mt-5 space-y-3">
                                        {queue.map((item) => (
                                            <div key={item.id} className="rounded-xl border border-border bg-background/25 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="truncate text-sm font-medium">{episodeFileName(item.episodeNumber)} · {item.title || "Bez tytułu"}</span>
                                                    {item.error && <TriangleAlert className="shrink-0 text-danger" size={18} />}
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                                                    <StatusMark done={item.uploaded} label="Plik" />
                                                    <StatusMark done={item.metadataSaved} label="Metadane" />
                                                    {hasIntro && <StatusMark done={item.chapterSaved} label="Czołówka" />}
                                                </div>
                                                {item.error && <p className="mt-3 text-sm text-danger">{item.error}</p>}
                                            </div>
                                        ))}
                                    </div>

                                    {isUploading && (
                                        <div className="mt-5 rounded-xl border border-border bg-surface-light/35 p-5" aria-live="polite">
                                            <div className="mb-3 flex justify-between gap-3 text-sm"><span className="truncate text-primary">{statusText}</span><strong>{progress}%</strong></div>
                                            <div className="h-3 overflow-hidden rounded-full bg-background"><motion.div className="h-full rounded-full bg-primary" animate={{ width: `${progress}%` }} /></div>
                                        </div>
                                    )}

                                    {resultMessage && (
                                        <div className={cn("mt-5 flex gap-3 rounded-xl border p-4 text-sm", allComplete ? "border-primary/30 bg-primary/10" : "border-warning/30 bg-warning/10")} aria-live="polite">
                                            {allComplete ? <CheckCircle2 className="shrink-0 text-primary" /> : <TriangleAlert className="shrink-0 text-warning" />}
                                            {resultMessage}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => void handleUpload()}
                                        disabled={isUploading || allComplete}
                                        className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-bold text-background transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isUploading ? <><LoaderCircle className="animate-spin" /> Trwa wysyłanie…</> : hasPartialState ? <><RotateCcw /> Ponów brakujące kroki</> : <><UploadCloud /> Rozpocznij wgrywanie</>}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {error && (
                        <div ref={errorRef} tabIndex={-1} className="mt-6 flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger outline-none" role="alert">
                            <TriangleAlert className="shrink-0" size={19} />
                            {error}
                        </div>
                    )}

                    <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                        <button type="button" disabled={step === 1 || isUploading} onClick={() => {
                            clearOperationState();
                            setStep((current) => Math.max(1, current - 1));
                        }} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-surface-light disabled:opacity-40">
                            <ArrowLeft size={17} /> Wstecz
                        </button>
                        {step < 5 && (
                            <button type="button" disabled={isUploading} onClick={() => validateStep(step + 1)} className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-background hover:bg-primary-hover disabled:opacity-50">
                                Dalej <ArrowRight size={17} />
                            </button>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
};

export default UploadWorkflow;
