import Link from "next/link";
import { Compass, Home } from "lucide-react";

const NotFound = () => (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center px-4 py-16 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">404</span>
        <h1 className="mt-3 font-display text-4xl text-foreground sm:text-5xl">Nie znaleziono strony</h1>
        <p className="mt-4 max-w-md text-sm text-muted">
            Strona, której szukasz, nie istnieje albo została przeniesiona.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-accent outline-none transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary"
            >
                <Home size={16} aria-hidden="true" />
                Strona główna
            </Link>
            <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-surface-light focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary"
            >
                <Compass size={16} aria-hidden="true" />
                Przeglądaj katalog
            </Link>
        </div>
    </div>
);

export default NotFound;
