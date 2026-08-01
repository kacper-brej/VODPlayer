"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DataErrorReason } from "@/lib/dataResult";

type DataStateKind = "empty" | "error" | "offline" | "inline" | "forbidden";
type DataStateAction = "retry" | "login" | null;

interface DataStateProps {
    kind: DataStateKind;
    title: string;
    description: string;
    action?: DataStateAction;
    compact?: boolean;
    onRetry?: () => void;
    headingLevel?: 1 | 2;
}

export const DataState = ({
    kind,
    title,
    description,
    action = null,
    compact = false,
    onRetry,
    headingLevel = 2,
}: DataStateProps) => {
    const router = useRouter();
    const isError = kind === "error" || kind === "offline" || kind === "forbidden";
    const Heading = headingLevel === 1 ? "h1" : "h2";

    return (
        <div
            role={isError ? "alert" : "status"}
            className={`flex w-full flex-col items-center justify-center rounded-2xl border border-nx-border bg-nx-panel text-center ${compact ? "min-h-36 px-5 py-6" : "min-h-64 px-6 py-10"}`}
        >
            <Heading className="text-base font-semibold text-nx-text md:text-lg">{title}</Heading>
            <p className="mt-2 max-w-lg text-sm text-nx-text-2">{description}</p>

            {action === "retry" && (
                <button
                    type="button"
                    onClick={onRetry ?? (() => router.refresh())}
                    className="mt-5 min-h-11 rounded-full bg-nx-accent px-5 py-2 text-sm font-semibold text-nx-on-accent outline-none transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                >
                    Spróbuj ponownie
                </button>
            )}

            {action === "login" && (
                <Link
                    href="/login"
                    className="mt-5 flex min-h-11 items-center rounded-full bg-nx-accent px-5 py-2 text-sm font-semibold text-nx-on-accent outline-none transition-colors duration-140 hover:bg-[color-mix(in_srgb,var(--nx-accent)_88%,var(--nx-text))] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-nx-accent"
                >
                    Zaloguj się
                </Link>
            )}
        </div>
    );
};

export const DataErrorState = ({
    reason,
    compact = false,
    onRetry,
    headingLevel = 2,
}: {
    reason: DataErrorReason;
    compact?: boolean;
    onRetry?: () => void;
    headingLevel?: 1 | 2;
}) => {
    if (reason === "unauthorized") {
        return (
            <DataState
                kind="forbidden"
                title="Wymagane logowanie"
                description="Zaloguj się, aby wczytać te dane."
                action="login"
                compact={compact}
                headingLevel={headingLevel}
            />
        );
    }

    if (reason === "forbidden") {
        return (
            <DataState
                kind="forbidden"
                title="Brak dostępu"
                description="To konto nie ma dostępu do tych danych."
                compact={compact}
                headingLevel={headingLevel}
            />
        );
    }

    if (reason === "network") {
        return (
            <DataState
                kind="offline"
                title="Brak połączenia"
                description="Sprawdź połączenie i spróbuj ponownie."
                action="retry"
                compact={compact}
                onRetry={onRetry}
                headingLevel={headingLevel}
            />
        );
    }

    return (
        <DataState
            kind="error"
            title="Nie udało się wczytać danych"
            description="Serwer jest chwilowo niedostępny albo zwrócił nieprawidłową odpowiedź."
            action="retry"
            compact={compact}
            onRetry={onRetry}
            headingLevel={headingLevel}
        />
    );
};

export const ContentSkeleton = () => (
    <div aria-hidden="true" className="flex w-full flex-col gap-6 px-4 py-8 sm:px-8">
        <div className="h-56 w-full rounded-2xl skeleton-pulse" />
        <div className="h-6 w-48 rounded-md skeleton-pulse" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="h-40 rounded-xl skeleton-pulse" />
            <div className="h-40 rounded-xl skeleton-pulse" />
            <div className="h-40 rounded-xl skeleton-pulse" />
            <div className="h-40 rounded-xl skeleton-pulse" />
        </div>
    </div>
);
