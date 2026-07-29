"use client"
import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

const Error = ({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) => {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-16">
            <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-danger/40 bg-surface px-6 py-10 text-center">
                <TriangleAlert size={28} className="text-danger" aria-hidden="true" />
                <h1 className="mt-4 font-display text-2xl text-foreground">Nie udało się wczytać strony</h1>
                <p className="mt-3 text-sm text-muted">
                    Coś poszło nie tak. Spróbuj ponownie — jeśli problem się powtórzy, wróć na stronę główną.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => unstable_retry()}
                        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-accent outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                    >
                        Spróbuj ponownie
                    </button>
                    <Link
                        href="/"
                        className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary"
                    >
                        Strona główna
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Error;
