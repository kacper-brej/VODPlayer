import Link from "next/link";

const SeriesNotFound = () => (
    <div className="flex min-h-[70vh] items-center justify-center bg-nx-bg px-5 py-24">
        <div className="w-full max-w-xl rounded-[28px] border border-nx-border bg-nx-panel p-8 text-center">
            <p className="font-mono text-[10px] tracking-[0.2em] text-nx-text-2">404</p>
            <h1 className="mt-3 font-display text-4xl text-nx-text">Nie znaleziono serialu</h1>
            <p className="mt-3 text-sm leading-relaxed text-nx-text-2">
                Ten tytuł nie istnieje albo nie jest już dostępny w katalogu.
            </p>
            <Link
                href="/"
                className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
            >
                Wróć do katalogu
            </Link>
        </div>
    </div>
);

export default SeriesNotFound;
