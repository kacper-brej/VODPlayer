import type { CatalogGenre } from "@/lib/contracts";

interface SeriesMetadataProps {
    year: number | null;
    rating: string | null;
    episodeCount: number;
    addedAt: number | null;
    progressAvailable: boolean;
    genres: CatalogGenre[];
    studio: string | null;
    audioLanguages: string[];
    subtitleLanguages: string[];
}

const languageNames = new Intl.DisplayNames(["pl"], { type: "language" });

const formatLanguages = (codes: string[]) =>
    codes
        .map((code) => {
            try {
                return languageNames.of(code) ?? code;
            } catch {
                return code;
            }
        })
        .join(", ");

const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(timestamp * 1000));

const SeriesMetadata = ({
    year,
    rating,
    episodeCount,
    addedAt,
    progressAvailable,
    genres,
    studio,
    audioLanguages,
    subtitleLanguages,
}: SeriesMetadataProps) => {
    const rows = [
        year ? { label: "Rok", value: String(year), numeric: true } : null,
        rating ? { label: "Ocena", value: rating, numeric: true } : null,
        genres.length > 0
            ? { label: "Gatunki", value: genres.map((genre) => genre.name).join(", "), numeric: false }
            : null,
        studio ? { label: "Studio", value: studio, numeric: false } : null,
        { label: "Odcinki", value: String(episodeCount), numeric: true },
        audioLanguages.length > 0
            ? { label: "Audio", value: formatLanguages(audioLanguages), numeric: false }
            : null,
        subtitleLanguages.length > 0
            ? { label: "Napisy", value: formatLanguages(subtitleLanguages), numeric: false }
            : null,
        addedAt ? { label: "Dodano", value: formatDate(addedAt), numeric: true } : null,
    ].filter((row): row is { label: string; value: string; numeric: boolean } => row !== null);

    return (
        <aside aria-label="Informacje o serialu" className="rounded-2xl border border-nx-border bg-nx-panel p-5 shadow-xl lg:p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1">
                {rows.map((row, index) => (
                    <div
                        key={row.label}
                        className={`flex flex-col gap-1 py-3 sm:flex-row sm:justify-between sm:gap-5 xl:flex-row ${index < rows.length - 1 ? "border-b border-nx-border" : ""}`}
                    >
                        <dt className="text-[12.5px] leading-[1.45] text-nx-text-2">{row.label}</dt>
                        <dd className={`${row.numeric ? "font-mono tabular-nums" : ""} text-[13.5px] leading-[1.45] text-nx-text sm:text-right`}>
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
            {!progressAvailable && (
                <p className="mt-4 text-sm leading-relaxed text-nx-text-2">
                    Postęp oglądania jest chwilowo niedostępny.
                </p>
            )}
        </aside>
    );
};

export default SeriesMetadata;
