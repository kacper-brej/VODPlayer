"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ManagedSeriesVisibility, SeriesVisibility } from "@/lib/core/contracts";
import { setSeriesVisibilityAction } from "@/lib/admin/accessControlActions";

interface SeriesVisibilityControlProps {
    seriesKey: string;
    visibility: SeriesVisibility;
}

const OPTIONS: Array<{ value: ManagedSeriesVisibility; label: string }> = [
    { value: "restricted", label: "Tylko wybrane konta" },
    { value: "public", label: "Każdy zalogowany" },
    { value: "admin", label: "Tylko administrator" },
];

const SeriesVisibilityControl = ({ seriesKey, visibility }: SeriesVisibilityControlProps) => {
    const router = useRouter();
    const selectId = useId();
    const [error, setError] = useState<string | null>(null);
    const [value, setValue] = useState<SeriesVisibility>(visibility);
    const [isPending, startTransition] = useTransition();

    if (visibility === "system") {
        return (
            <span className="inline-flex min-h-7 items-center rounded-full border border-nx-border px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-nx-text-2">
                Materiał techniczny
            </span>
        );
    }

    const handleChange = (next: string) => {
        const previous = value;
        setError(null);
        setValue(next as SeriesVisibility);

        startTransition(async () => {
            const result = await setSeriesVisibilityAction(seriesKey, next);

            if (result.kind !== "success") {
                setValue(previous);
                setError("Nie udało się zapisać.");
                return;
            }

            router.refresh();
        });
    };

    return (
        <span className="flex flex-wrap items-center justify-end gap-2">
            {error && <span className="text-xs text-nx-critical">{error}</span>}
            <label htmlFor={selectId} className="sr-only">
                Poziom dostępu dla {seriesKey}
            </label>
            <select
                id={selectId}
                value={value}
                disabled={isPending}
                onChange={(event) => handleChange(event.target.value)}
                className="min-h-9 rounded-full border border-nx-border bg-nx-raised px-3 text-xs text-nx-text outline-none transition-colors duration-140 hover:border-nx-accent disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
            >
                {OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </span>
    );
};

export default SeriesVisibilityControl;
