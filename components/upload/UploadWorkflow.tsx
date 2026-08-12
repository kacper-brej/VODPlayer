import { CheckCircle2, Terminal, TriangleAlert } from "lucide-react";
import MetadataReviewPanel from "@/components/upload/MetadataReviewPanel";
import type { UploadWorkflowSetup } from "@/lib/upload/uploadWorkflowTypes";

const UploadWorkflow = ({ initialSetup }: { initialSetup: UploadWorkflowSetup }) => {
    if (initialSetup.unauthorized) {
        return (
            <section className="rounded-2xl border border-nx-critical/30 bg-nx-critical/10 p-6" role="alert">
                <h1 className="font-display text-3xl text-nx-text">Brak dostępu</h1>
                <p className="mt-2 text-sm text-nx-text-2">Zaloguj się ponownie na konto administratora.</p>
            </section>
        );
    }

    const pendingWithoutPoster = initialSetup.metadataReview.filter((item) =>
        !item.artwork.some((artwork) => artwork.kind === "poster" && artwork.isPrimary)
    ).length;

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-nx-border bg-nx-panel p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="max-w-3xl">
                        <p className="font-mono text-xs uppercase tracking-[0.18em] text-nx-accent">HLS-only</p>
                        <h1 className="mt-1 font-display text-2xl text-nx-text md:text-3xl">Nowy materiał trafia przez transkoder</h1>
                        <p className="mt-2 text-sm leading-5 text-nx-text-2">
                            Pliki wideo nie są już wysyłane przez przeglądarkę. Transkoder przygotowuje HLS,
                            zapisuje obiekty w B2 i rejestruje odcinek w aplikacji.
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-nx-border bg-nx-raised px-3 py-1.5 text-xs text-nx-text">
                        <CheckCircle2 size={16} className="text-nx-accent" />
                        {pendingWithoutPoster} czeka na plakat
                    </span>
                </div>

                <div className="mt-4 rounded-xl border border-nx-border bg-nx-bg p-3 xl:flex xl:items-center xl:gap-5">
                    <div className="flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-nx-text-2">
                        <Terminal size={15} /> Polecenie
                    </div>
                    <code className="mt-2 block overflow-x-auto whitespace-nowrap font-mono text-xs text-nx-text xl:mt-0 xl:text-sm">
                        npm run transcode -- --input &lt;plik.mp4&gt; --series &quot;Nazwa serii&quot; --episode &lt;numer&gt;
                    </code>
                </div>

                {initialSetup.unavailable && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-nx-critical/30 bg-nx-critical/10 p-3 text-sm text-nx-critical" role="alert">
                        <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                        Część danych panelu jest chwilowo niedostępna. Odśwież stronę przed podjęciem decyzji o publikacji.
                    </p>
                )}
            </section>

            <MetadataReviewPanel initialItems={initialSetup.metadataReview} />
        </div>
    );
};

export default UploadWorkflow;
