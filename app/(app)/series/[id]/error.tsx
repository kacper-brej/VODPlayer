"use client";

import { useEffect } from "react";

const SeriesError = ({
    error,
    retry,
}: {
    error: Error & { digest?: string };
    retry: () => void;
}) => {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-[70vh] items-center justify-center bg-nx-bg px-5 py-24">
            <div role="alert" className="w-full max-w-xl rounded-2xl border border-[color-mix(in_srgb,var(--nx-critical)_40%,transparent)] bg-nx-panel p-8 text-center">
                <h1 className="font-display text-4xl text-nx-text">Nie udało się otworzyć serialu</h1>
                <p className="mt-3 text-sm leading-relaxed text-nx-text-2">
                    Dane są chwilowo niedostępne. Spróbuj ponownie.
                </p>
                <button
                    type="button"
                    onClick={() => retry()}
                    className="mt-6 min-h-12 rounded-xl bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                >
                    Spróbuj ponownie
                </button>
            </div>
        </div>
    );
};

export default SeriesError;
