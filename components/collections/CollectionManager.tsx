"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
    addToCollectionAction,
    createCollectionAction,
    deleteCollectionAction,
    removeFromCollectionAction,
    renameCollectionAction,
} from "@/lib/collections/collectionsActions";

interface SeriesOption {
    key: string;
    title: string;
}

const errorMessage = "Nie udało się zapisać zmiany. Sprawdź dane i spróbuj ponownie.";

export const CreateCollectionForm = () => {
    const router = useRouter();
    const [name, setName] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);

        startTransition(async () => {
            const result = await createCollectionAction(name);
            if (result.kind !== "success") {
                setMessage(errorMessage);
                return;
            }

            setName("");
            router.push(`/collections?collection=${result.data.id}`);
            router.refresh();
        });
    };

    return (
        <form onSubmit={submit} className="mb-8 flex max-w-xl flex-col gap-3 rounded-2xl border border-nx-border bg-nx-panel p-4 sm:flex-row sm:items-end sm:flex-wrap">
            <label className="min-w-0 flex-1">
                <span className="mb-2 block font-mono text-[10px] tracking-[0.16em] text-nx-text-2">NOWA KOLEKCJA</span>
                <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={100}
                    placeholder="Nazwa kolekcji"
                    className="min-h-11 w-full rounded-xl border border-nx-border bg-nx-bg px-4 text-sm text-nx-text outline-none placeholder:text-nx-text-2 focus-visible:border-nx-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent"
                />
            </label>
            <button
                type="submit"
                disabled={pending || name.trim().length === 0}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:opacity-55"
            >
                <Plus size={16} aria-hidden="true" />
                {pending ? "Tworzenie…" : "Utwórz"}
            </button>
            {message && <p role="alert" className="text-xs text-danger sm:basis-full">{message}</p>}
        </form>
    );
};

export const CollectionControls = ({
    collectionId,
    collectionName,
    availableSeries,
}: {
    collectionId: number;
    collectionName: string;
    availableSeries: SeriesOption[];
}) => {
    const router = useRouter();
    const [name, setName] = useState(collectionName);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const rename = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(null);
        startTransition(async () => {
            const result = await renameCollectionAction(collectionId, name);
            setMessage(result.kind === "success" ? "Nazwa została zapisana." : errorMessage);
            if (result.kind === "success") router.refresh();
        });
    };

    const addSeries = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const selectedSeries = String(new FormData(event.currentTarget).get("series") ?? "");
        if (!selectedSeries) return;
        setMessage(null);
        startTransition(async () => {
            const result = await addToCollectionAction(collectionId, selectedSeries);
            setMessage(result.kind === "success" ? "Tytuł został dodany." : errorMessage);
            if (result.kind === "success") router.refresh();
        });
    };

    const removeCollection = () => {
        setMessage(null);
        startTransition(async () => {
            const result = await deleteCollectionAction(collectionId);
            if (result.kind !== "success") {
                setMessage(errorMessage);
                setConfirmDelete(false);
                return;
            }

            router.replace("/collections");
            router.refresh();
        });
    };

    return (
        <div className="mb-10 grid gap-4 rounded-2xl border border-nx-border bg-nx-panel p-4 lg:grid-cols-2">
            <form onSubmit={rename} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                    <span className="mb-2 block font-mono text-[10px] tracking-[0.16em] text-nx-text-2">NAZWA</span>
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        maxLength={100}
                        className="min-h-11 w-full rounded-xl border border-nx-border bg-nx-bg px-4 text-sm text-nx-text outline-none focus-visible:border-nx-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent"
                    />
                </label>
                <button type="submit" disabled={pending || name.trim().length === 0 || name.trim() === collectionName} className="min-h-11 rounded-full border border-nx-border bg-nx-raised px-5 text-sm font-semibold text-nx-text outline-none hover:border-nx-accent/50 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:opacity-55">
                    Zapisz nazwę
                </button>
            </form>

            <form onSubmit={addSeries} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                    <span className="mb-2 block font-mono text-[10px] tracking-[0.16em] text-nx-text-2">DODAJ TYTUŁ</span>
                    <select
                        name="series"
                        defaultValue={availableSeries[0]?.key ?? ""}
                        disabled={availableSeries.length === 0}
                        className="min-h-11 w-full rounded-xl border border-nx-border bg-nx-bg px-4 text-sm text-nx-text outline-none focus-visible:border-nx-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nx-accent disabled:opacity-55"
                    >
                        {availableSeries.length === 0 ? (
                            <option value="">Wszystkie tytuły są już dodane</option>
                        ) : availableSeries.map((series) => (
                            <option key={series.key} value={series.key}>{series.title}</option>
                        ))}
                    </select>
                </label>
                <button type="submit" disabled={pending || availableSeries.length === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent disabled:cursor-not-allowed disabled:opacity-55">
                    <Plus size={16} aria-hidden="true" />
                    Dodaj
                </button>
            </form>

            <div className="flex flex-wrap items-center gap-3 border-t border-nx-border pt-4 lg:col-span-2">
                {confirmDelete ? (
                    <>
                        <p className="mr-auto text-sm text-nx-text">Usunąć kolekcję wraz z jej zawartością?</p>
                        <button type="button" onClick={() => setConfirmDelete(false)} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-nx-border px-4 text-sm font-semibold text-nx-text outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent">
                            <X size={16} aria-hidden="true" />
                            Anuluj
                        </button>
                        <button type="button" onClick={removeCollection} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-4 text-sm font-semibold text-white outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-danger disabled:opacity-55">
                            <Trash2 size={16} aria-hidden="true" />
                            {pending ? "Usuwanie…" : "Usuń kolekcję"}
                        </button>
                    </>
                ) : (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger outline-none hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-danger">
                        <Trash2 size={16} aria-hidden="true" />
                        Usuń kolekcję
                    </button>
                )}
                {message && <p role="status" aria-live="polite" className="text-xs text-nx-text-2">{message}</p>}
            </div>
        </div>
    );
};

export const RemoveFromCollectionButton = ({
    collectionId,
    seriesKey,
    title,
}: {
    collectionId: number;
    seriesKey: string;
    title: string;
}) => {
    const router = useRouter();
    const [failed, setFailed] = useState(false);
    const [pending, startTransition] = useTransition();

    return (
        <>
            <button
                type="button"
                disabled={pending}
                onClick={() => {
                    setFailed(false);
                    startTransition(async () => {
                        const result = await removeFromCollectionAction(collectionId, seriesKey);
                        if (result.kind === "success") router.refresh();
                        else setFailed(true);
                    });
                }}
                aria-label={`Usuń ${title} z kolekcji`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-nx-border px-3 text-xs font-semibold text-nx-text-2 outline-none hover:border-danger/50 hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-55"
            >
                <X size={14} aria-hidden="true" />
                {pending ? "Usuwanie…" : "Usuń"}
            </button>
            {failed && <span role="alert" className="sr-only">Nie udało się usunąć tytułu.</span>}
        </>
    );
};
