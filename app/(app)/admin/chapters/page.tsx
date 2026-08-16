import ChapterEditor from "@/components/admin/ChapterEditor";
import { DataErrorState, DataState } from "@/components/data/DataState";
import { getAdminLibraryAction } from "@/lib/admin/adminActions";

const AdminChaptersPage = async () => {
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
            <div className="max-w-3xl">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">Odtwarzacz</p>
                <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">Rozdziały odcinków</h1>
                <p className="mt-3 text-sm leading-6 text-nx-text-2">Ustaw zakresy intro, recap i outro dla przycisków pomijania w odtwarzaczu.</p>
            </div>

            {series.length === 0 ? (
                <DataState kind="empty" title="Brak odcinków" description="Opublikuj pierwszy odcinek, aby ustawić jego rozdziały." />
            ) : (
                <ChapterEditor series={series} />
            )}
        </div>
    );
};

export default AdminChaptersPage;
