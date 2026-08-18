"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import type { SeriesAccessOverviewResponse } from "@/lib/core/contracts";
import { grantSeriesAccessAction, revokeSeriesAccessAction } from "@/lib/admin/accessControlActions";

type Overview = SeriesAccessOverviewResponse;

const grantKey = (seriesKey: string, userId: number): string => `${userId}::${seriesKey}`;

const SeriesAccessMatrix = ({ overview }: { overview: Overview }) => {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const restrictedSeries = useMemo(
        () => overview.series.filter((entry) => entry.visibility === "restricted"),
        [overview.series],
    );
    const viewers = useMemo(() => overview.users.filter((user) => user.role !== "admin"), [overview.users]);
    const granted = useMemo(
        () => new Set(overview.grants.map((grant) => grantKey(grant.seriesKey, grant.userId))),
        [overview.grants],
    );

    const toggle = (seriesKey: string, userId: number, hasAccess: boolean) => {
        const key = grantKey(seriesKey, userId);
        setError(null);
        setPendingKey(key);

        startTransition(async () => {
            const result = hasAccess
                ? await revokeSeriesAccessAction(seriesKey, userId)
                : await grantSeriesAccessAction(seriesKey, userId);

            setPendingKey(null);

            if (result.kind !== "success") {
                setError("Nie udało się zapisać zmiany dostępu.");
                return;
            }

            router.refresh();
        });
    };

    if (viewers.length === 0) {
        return (
            <p className="text-sm leading-6 text-nx-text-2">
                Nie ma kont widzów. Administratorzy mają dostęp do wszystkich tytułów bez nadawania uprawnień.
            </p>
        );
    }

    if (restrictedSeries.length === 0) {
        return (
            <p className="text-sm leading-6 text-nx-text-2">
                Żaden tytuł nie jest obecnie dostępny tylko dla wybranych kont. Ustaw taki dostęp w Bibliotece,
                a pojawi się tutaj do przypisania.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {error && <p className="text-sm text-nx-critical">{error}</p>}

            {viewers.map((user) => (
                <section
                    key={user.id}
                    className="rounded-[var(--r-m)] border border-nx-border bg-nx-panel p-5 shadow-[var(--sh-2)] transition-colors duration-140 hover:border-nx-text-2/40"
                >
                    <h3 className="text-sm font-semibold text-nx-text">{user.username}</h3>
                    <p className="mt-1 truncate font-mono text-[11px] text-nx-text-2" title={user.email}>
                        {user.email}
                    </p>

                    <ul className="mt-4 flex flex-col gap-2">
                        {restrictedSeries.map((entry) => {
                            const key = grantKey(entry.seriesKey, user.id);
                            const hasAccess = granted.has(key);
                            const isBusy = pendingKey === key;

                            return (
                                <li key={entry.seriesKey} className="flex items-center justify-between gap-3">
                                    <span className="min-w-0 truncate text-sm text-nx-text-2" title={entry.seriesKey}>
                                        {entry.seriesKey}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => toggle(entry.seriesKey, user.id, hasAccess)}
                                        disabled={isBusy}
                                        aria-pressed={hasAccess}
                                        className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs outline-none transition-colors duration-140 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent ${
                                            hasAccess
                                                ? "border-nx-accent bg-nx-accent text-nx-on-accent hover:brightness-110"
                                                : "border-nx-border bg-transparent text-nx-text-2 hover:border-nx-accent hover:bg-nx-raised hover:text-nx-text"
                                        }`}
                                    >
                                        {hasAccess ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
                                        {isBusy ? "Zapisywanie…" : hasAccess ? "Ma dostęp" : "Nadaj dostęp"}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
};

export default SeriesAccessMatrix;
