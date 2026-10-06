import Link from "next/link";
import { ArrowRight, FolderPlus } from "lucide-react";
import MetadataReviewPanel from "@/components/upload/MetadataReviewPanel";
import AdminFeedback from "@/components/admin/AdminFeedback";
import s from "@/components/admin/admin.module.css";
import type { UploadWorkflowSetup } from "@/lib/upload/uploadWorkflowTypes";

export default function UploadWorkflow({ initialSetup }: { initialSetup: UploadWorkflowSetup }) {
    if (initialSetup.unauthorized) return <div className={s.page}><AdminFeedback tone="error">Zaloguj się na konto administratora, aby zarządzać materiałami.</AdminFeedback></div>;

    return <div className={s.page}>
        <div className={s.header}>
            <div>
                <h1>Materiały i grafiki</h1>
                <p className={s.description}>Wybierz tytuł. Pobierz opis, plakat i baner z TMDB, a potem sprawdź, jak wyglądają.</p>
            </div>
            <a className={s.secondary} href="#add-material"><FolderPlus size={17} aria-hidden="true" />Dodaj materiał</a>
        </div>
        {initialSetup.unavailable && <div className="mb-5"><AdminFeedback tone="error">Nie udało się wczytać całej biblioteki. Odśwież stronę, aby spróbować ponownie.</AdminFeedback></div>}
        <MetadataReviewPanel initialItems={initialSetup.metadataReview} />
        <section id="add-material" className={`${s.details} mt-8`}>
            <h2 className="mb-4">Dodaj nowy film lub odcinek</h2>
            <div className={s.stack}>
                <p className={s.description}>Plik wideo musi najpierw trafić na serwer i zostać przygotowany do odtwarzania przez transkoder. Gotowy materiał pojawi się na liście powyżej, gdzie dobierzesz jego opis i grafiki.</p>
                <div className={s.row}><Link href="/admin/library-scan" className={s.secondary}>Sprawdź pliki na serwerze <ArrowRight size={16} aria-hidden="true" /></Link><span className={s.muted}>Przesyłanie wideo przez przeglądarkę nie jest dostępne.</span></div>
            </div>
        </section>
    </div>;
}
