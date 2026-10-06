import ChapterEditor from "@/components/admin/ChapterEditor";
import { DataErrorState, DataState } from "@/components/data/DataState";
import { getAdminLibraryAction } from "@/lib/admin/adminActions";
import s from "@/components/admin/admin.module.css";

const AdminChaptersPage = async ({ searchParams }: { searchParams: Promise<{ series?: string }> }) => {
    const { series: initialSeriesKey } = await searchParams;
    const result = await getAdminLibraryAction();

    if (result.kind === "error") {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
                <DataErrorState reason={result.reason} headingLevel={1} />
            </div>
        );
    }

    const series = result.data.series.filter((item) => item.episodes.length > 0);

    return (
        <div className={s.page}>
            <div className={s.header}>
                <div><h1>Pomijanie i rozdziały</h1>
                <p className={s.description}>Zaznacz czołówkę, przypomnienie lub napisy końcowe. Widz będzie mógł pominąć te fragmenty jednym kliknięciem.</p></div>
            </div>

            {series.length === 0 ? (
                <DataState kind="empty" title="Brak odcinków" description="Opublikuj pierwszy odcinek, aby ustawić jego rozdziały." />
            ) : (
                <ChapterEditor series={series} initialSeriesKey={initialSeriesKey} />
            )}
        </div>
    );
};

export default AdminChaptersPage;
