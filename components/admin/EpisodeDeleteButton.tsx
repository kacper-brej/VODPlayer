"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAdminMediaAction } from "@/lib/adminStorageActions";

interface EpisodeDeleteButtonProps {
    seriesKey: string;
    episodeKey: string;
}

const EpisodeDeleteButton = ({ seriesKey, episodeKey }: EpisodeDeleteButtonProps) => {
    const router = useRouter();
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            const result = await deleteAdminMediaAction(seriesKey, episodeKey);

            if (result.kind !== "success") {
                setError("Nie udało się usunąć.");
                return;
            }

            setIsConfirming(false);
            router.refresh();
        });
    };

    if (isConfirming) {
        return (
            <span className="flex flex-wrap items-center justify-end gap-2">
                {error && <span className="text-xs text-nx-critical">{error}</span>}
                <button
                    type="button"
                    onClick={() => setIsConfirming(false)}
                    disabled={isPending}
                    className="rounded-full border border-nx-border px-3 py-1.5 text-xs text-nx-text-2 outline-none transition-colors duration-140 hover:bg-nx-raised disabled:opacity-60"
                >
                    Anuluj
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="rounded-full border border-nx-critical bg-nx-critical/10 px-3 py-1.5 text-xs font-semibold text-nx-critical outline-none transition-colors duration-140 hover:bg-nx-critical/20 disabled:opacity-60"
                >
                    {isPending ? "Usuwanie…" : "Na pewno usuń"}
                </button>
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={() => setIsConfirming(true)}
            aria-label={`Usuń ${seriesKey}/${episodeKey} z B2 i serwera`}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-nx-border text-nx-text-2 outline-none transition-colors duration-140 hover:border-nx-critical hover:text-nx-critical"
        >
            <Trash2 size={15} />
        </button>
    );
};

export default EpisodeDeleteButton;
