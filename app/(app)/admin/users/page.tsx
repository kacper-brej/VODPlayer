import { DataErrorState, DataState } from "@/components/data/DataState";
import { getAdminUsersAction } from "@/lib/admin/adminActions";
import { getSeriesAccessOverviewAction } from "@/lib/admin/accessControlActions";
import SeriesAccessMatrix from "@/components/admin/SeriesAccessMatrix";

const formatDate = (unixSeconds: number): string =>
    new Date(unixSeconds * 1000).toLocaleDateString("pl-PL", { year: "numeric", month: "short", day: "numeric" });

const AdminUsersPage = async () => {
    const [result, accessOverview] = await Promise.all([
        getAdminUsersAction(),
        getSeriesAccessOverviewAction(),
    ]);

    if (result.kind === "error") {
        return (
            <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
                <DataErrorState reason={result.reason} headingLevel={1} />
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
            <div className="max-w-3xl">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                    Dostęp
                </p>
                <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">
                    Konta
                </h1>
                <p className="mt-3 text-sm leading-6 text-nx-text-2">
                    Rolę administratora można nadać tylko bezpośrednio w bazie. Dostęp do poszczególnych
                    tytułów ustawisz niżej.
                </p>
            </div>

            {result.data.users.length === 0 && (
                <DataState
                    kind="empty"
                    title="Brak kont"
                    description="Serwer nie zwrócił żadnego konta użytkownika."
                />
            )}

            {result.data.users.length > 0 && (
                <div className="overflow-x-auto rounded-[var(--r-m)] border border-nx-border bg-nx-panel shadow-[var(--sh-2)]">
                    <table className="w-full min-w-[720px] table-fixed text-left text-sm">
                        <thead>
                            <tr className="border-b border-nx-border text-[10px] uppercase tracking-[0.14em] text-nx-text-2">
                                <th scope="col" className="w-[18%] px-5 py-3.5 font-mono font-normal">Nazwa</th>
                                <th scope="col" className="w-[30%] px-5 py-3.5 font-mono font-normal">E-mail</th>
                                <th scope="col" className="w-[18%] px-5 py-3.5 font-mono font-normal">Zweryfikowano</th>
                                <th scope="col" className="w-[14%] px-5 py-3.5 font-mono font-normal">Rola</th>
                                <th scope="col" className="w-[20%] px-5 py-3.5 font-mono font-normal">Utworzono</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.data.users.map((user) => (
                                <tr key={user.id} className="border-b border-nx-border/60 transition-colors duration-140 last:border-0 hover:bg-nx-raised/50">
                                    <td className="px-5 py-4 text-nx-text">
                                        <span className="block truncate font-medium" title={user.username}>
                                            {user.username}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-nx-text-2">
                                        <span className="block truncate" title={user.email}>{user.email}</span>
                                    </td>
                                    <td className="px-5 py-4 font-mono text-xs text-nx-text-2">
                                        {user.emailVerified ? "Tak" : "Nie"}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`inline-flex min-h-7 items-center rounded-full px-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] ${
                                                user.role === "admin"
                                                    ? "bg-nx-accent text-nx-on-accent"
                                                    : "border border-nx-border bg-transparent text-nx-text-2"
                                            }`}
                                        >
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 font-mono text-xs text-nx-text-2 [font-variant-numeric:tabular-nums]">
                                        {formatDate(user.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <section className="flex flex-col gap-4">
                <div className="max-w-3xl">
                    <h2 className="font-display text-[24px] leading-[1.15] tracking-[-0.02em] text-nx-text">
                        Dostęp do tytułów
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-nx-text-2">
                        Lista obejmuje tytuły dostępne tylko dla wybranych kont. Konto bez uprawnienia widzi kafelek
                        z opisami, ale odtwarza materiał demonstracyjny. Nadanie dostępu usuwa postęp zebrany
                        na tym materiale.
                    </p>
                </div>

                {accessOverview.kind === "error"
                    ? <DataErrorState reason={accessOverview.reason} headingLevel={2} />
                    : <SeriesAccessMatrix overview={accessOverview.data} />}
            </section>
        </div>
    );
};

export default AdminUsersPage;
