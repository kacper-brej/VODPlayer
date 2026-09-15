"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { loadSeriesModal, type SeriesModalModule } from "@/lib/catalog/loadSeriesModal";
import { setSeriesInfoId } from "@/lib/catalog/seriesInfoHistory";
import { useModalFocus } from "@/lib/core/useModalFocus";

const ModalLoading = ({ failed, onRetry }: { failed: boolean; onRetry: () => void }) => {
    const close = () => setSeriesInfoId(null);
    const modalRef = useModalFocus<HTMLDivElement>(true, close);
    return (
        <div onClick={close} className="fixed inset-0 z-50 flex items-start justify-center bg-background/90 p-0 md:p-4 md:pt-[5vh]">
            <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Szczegóły serialu" tabIndex={-1} onClick={(event) => event.stopPropagation()} className="relative flex min-h-64 w-full flex-col items-center justify-center gap-4 bg-surface p-8 pt-20 text-foreground shadow-2xl outline-none md:max-w-4xl md:rounded-xl">
                <button type="button" onClick={close} aria-label="Zamknij szczegóły serialu" className="absolute right-4 top-[calc(16px+env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full border border-border bg-surface-light text-2xl outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary md:top-4">×</button>
                <p role={failed ? "alert" : "status"}>{failed ? "Nie udało się załadować szczegółów." : "Ładowanie szczegółów…"}</p>
                {failed && <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-border bg-surface-light px-4 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary">Spróbuj ponownie</button>}
            </div>
        </div>
    );
};

const DeferredSeriesModal = () => {
    const movieId = useSearchParams().get("info");
    const [loaded, setLoaded] = useState<SeriesModalModule | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [failedRequest, setFailedRequest] = useState<string | null>(null);
    const requestKey = `${movieId}:${attempt}`;

    useEffect(() => {
        if (!movieId || loaded) return;
        let active = true;
        void loadSeriesModal().then(
            (module) => { if (active) setLoaded(module); },
            () => { if (active) setFailedRequest(requestKey); },
        );
        return () => { active = false; };
    }, [movieId, loaded, requestKey]);

    if (loaded) return <loaded.default />;
    return movieId ? <ModalLoading failed={failedRequest === requestKey} onRetry={() => setAttempt((value) => value + 1)} /> : null;
};

const LazySeriesModal = () => {
    const { user } = useAuth();
    return user ? <DeferredSeriesModal key={user.id} /> : null;
};

export default LazySeriesModal;
