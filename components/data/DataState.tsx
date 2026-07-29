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
}

export const DataState = ({
    kind,
    title,
    description,
    action = null,
    compact = false,
    onRetry,
}: DataStateProps) => {
    const router = useRouter();
    const isError = kind === "error" || kind === "offline" || kind === "forbidden";

    return (
        <div
            role={isError ? "alert" : "status"}
            className={`flex w-full flex-col items-center justify-center rounded-xl border border-border bg-surface text-center ${compact ? "min-h-36 px-5 py-6" : "min-h-64 px-6 py-10"}`}
        >
            <h2 className="text-base font-semibold text-foreground md:text-lg">{title}</h2>
            <p className="mt-2 max-w-lg text-sm text-muted">{description}</p>

            {action === "retry" && (
                <button
                    type="button"
                    onClick={onRetry ?? (() => router.refresh())}
                    className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-accent outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                >
                    Try again
                </button>
            )}

            {action === "login" && (
                <Link
                    href="/login"
                    className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-accent outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                >
                    Sign in
                </Link>
            )}
        </div>
    );
};

export const DataErrorState = ({
    reason,
    compact = false,
    onRetry,
}: {
    reason: DataErrorReason;
    compact?: boolean;
    onRetry?: () => void;
}) => {
    if (reason === "unauthorized") {
        return (
            <DataState
                kind="forbidden"
                title="Sign in required"
                description="Sign in to load this data."
                action="login"
                compact={compact}
            />
        );
    }

    if (reason === "forbidden") {
        return (
            <DataState
                kind="forbidden"
                title="Access denied"
                description="Your account does not have access to this data."
                compact={compact}
            />
        );
    }

    if (reason === "network") {
        return (
            <DataState
                kind="offline"
                title="No connection"
                description="Check your connection and try again."
                action="retry"
                compact={compact}
                onRetry={onRetry}
            />
        );
    }

    return (
        <DataState
            kind="error"
            title="Could not load data"
            description="The server returned an invalid response or is temporarily unavailable."
            action="retry"
            compact={compact}
            onRetry={onRetry}
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
