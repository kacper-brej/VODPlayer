import { DataErrorState } from "@/components/data/DataState";
import { getAdminLibraryAction, getAdminUsersAction } from "@/lib/adminActions";

const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

const StatTile = ({ label, value }: { label: string; value: string | number | null }) => (
    <article className="min-w-0 rounded-[var(--r-m)] border border-nx-border bg-nx-panel px-5 py-5 shadow-[var(--sh-2)]">
        <p className="min-h-7 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-text-2">
            {label}
        </p>
        <p className="mt-2 truncate font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-none tracking-[-0.025em] text-nx-text [font-variant-numeric:tabular-nums]">
            {value ?? "—"}
        </p>
    </article>
);

const AdminOverviewPage = async () => {
    const [libraryResult, usersResult] = await Promise.all([getAdminLibraryAction(), getAdminUsersAction()]);

    const seriesCount = libraryResult.kind === "success" ? libraryResult.data.series.length : null;
    const episodeCount =
        libraryResult.kind === "success"
            ? libraryResult.data.series.reduce((total, item) => total + item.episodeCount, 0)
            : null;
    const totalBytes =
        libraryResult.kind === "success"
            ? libraryResult.data.series.reduce((total, item) => total + item.totalBytes, 0)
            : null;
    const userCount = usersResult.kind === "success" ? usersResult.data.users.length : null;

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
            <div className="max-w-3xl">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                    Przegląd
                </p>
                <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">
                    Panel administracyjny
                </h1>
                <p className="mt-3 text-sm leading-6 text-nx-text-2">
                    Widok obejmuje wyłącznie lokalną bibliotekę. Status migracji do Backblaze B2 będzie dostępny po
                    utworzeniu rejestru mediów.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Seriale" value={seriesCount} />
                <StatTile label="Odcinki" value={episodeCount} />
                <StatTile label="Rozmiar biblioteki" value={totalBytes !== null ? formatBytes(totalBytes) : null} />
                <StatTile label="Konta" value={userCount} />
            </div>

            {(libraryResult.kind === "error" || usersResult.kind === "error") && (
                <div className="grid gap-4">
                    {libraryResult.kind === "error" && (
                        <section aria-label="Błąd danych biblioteki">
                            <DataErrorState reason={libraryResult.reason} compact />
                        </section>
                    )}
                    {usersResult.kind === "error" && (
                        <section aria-label="Błąd danych kont">
                            <DataErrorState reason={usersResult.reason} compact />
                        </section>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminOverviewPage;
