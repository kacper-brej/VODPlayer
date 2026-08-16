import LibraryScanPanel from "@/components/admin/LibraryScanPanel";

export const dynamic = "force-dynamic";

const AdminLibraryScanPage = () => (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
        <header className="max-w-3xl">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                Import
            </p>
            <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">
                Pliki na serwerze
            </h1>
            <p className="mt-3 text-sm leading-6 text-nx-text-2">
                Wgraj pliki przez FTP do katalogu <code className="text-nx-text">uploads/</code>, a następnie
                zarejestruj je jako odcinki. Odcinek pojawi się w katalogu po dodaniu okładki serii.
            </p>
        </header>

        <LibraryScanPanel />
    </div>
);

export default AdminLibraryScanPage;
