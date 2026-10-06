import Link from "next/link";
import { ArrowRight, FolderOpen, Images, Scissors } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { DataErrorState } from "@/components/data/DataState";
import { getAdminLibraryAction, getAdminUsersAction, getPartyTelemetryAction } from "@/lib/admin/adminActions";
import { getMediaStorageStatus } from "@/lib/admin/mediaStorageStatus";
import { estimateB2MonthlyStorageCostUsd, formatB2Bytes } from "@/lib/admin/b2Storage";

const formatInteger = (value: number): string => value.toLocaleString("pl-PL");

const formatDecimal = (value: number, digits = 2): string =>
    value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatSeconds = (milliseconds: number): string => `${formatDecimal(milliseconds / 1000)} s`;

const StatTile = ({ label, value, detail }: { label: string; value: string | number | null; detail?: string }) => (
    <article className="min-w-0 rounded-[var(--r-m)] border border-nx-border bg-nx-panel px-5 py-5 shadow-[var(--sh-2)]">
        <p className="min-h-7 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-text-2">
            {label}
        </p>
        <p className="mt-2 break-words font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-none tracking-[-0.025em] text-nx-text [font-variant-numeric:tabular-nums]">
            {value ?? "Brak"}
        </p>
        {detail && <p className="mt-3 text-xs leading-5 text-nx-text-2">{detail}</p>}
    </article>
);

const AdminOverviewPage = async () => {
    const [libraryResult, usersResult, mediaStorageResult, partyTelemetryResult] = await Promise.all([
        getAdminLibraryAction(),
        getAdminUsersAction(),
        getMediaStorageStatus(),
        getPartyTelemetryAction(),
    ]);

    const seriesCount = libraryResult.kind === "success" ? libraryResult.data.series.length : null;
    const episodeCount =
        libraryResult.kind === "success"
            ? libraryResult.data.series.reduce((total, item) => total + item.episodeCount, 0)
            : null;
    const userCount = usersResult.kind === "success" ? usersResult.data.users.length : null;

    const mediaAssets = mediaStorageResult.kind === "success" ? mediaStorageResult.data.assets : [];
    const hlsAssets = mediaAssets.filter((asset) => asset.delivery === "hls");
    const readyAssets = hlsAssets.filter((asset) => asset.status === "ready");
    const processingAssets = hlsAssets.filter((asset) => asset.status === "pending" || asset.status === "processing");
    const failedAssets = hlsAssets.filter((asset) => asset.status === "failed" || asset.status === "delete_failed");
    const deletedAssets = hlsAssets.filter((asset) => asset.status === "deleted");
    const readyTotalBytes = readyAssets.reduce((total, asset) => total + (asset.totalSizeBytes ?? 0), 0);
    const estimatedMonthlyCost = estimateB2MonthlyStorageCostUsd(readyTotalBytes);
    const lastVerification = mediaStorageResult.kind === "success" ? mediaStorageResult.data.lastVerification : null;

    return (
        <div className={`${s.page} flex flex-col gap-6`}>
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
                <div className="max-w-3xl">
                    <h1>Przegląd biblioteki</h1>
                    <p className="mt-3 text-sm leading-6 text-nx-text-2">
                        Dodaj materiał, dopasuj grafiki i przygotuj odtwarzacz dla widzów.
                    </p>
                </div>
                <Link
                    href="/admin/upload"
                    className={s.button}
                >
                    <Images aria-hidden="true" className="size-4" />
                    Materiały i grafiki
                </Link>
            </div>

            <div className={s.shortcuts}>
                {[
                    { href: "/admin/upload", icon: Images, title: "Dodaj opis i grafiki", text: "Wyszukaj tytuł w TMDB. Plakat, baner i dostępne logo pobierzesz w jednym miejscu." },
                    { href: "/admin/chapters", icon: Scissors, title: "Ustaw pomijanie czołówki", text: "Wpisz czas jak w odtwarzaczu, np. 01:30. Dodaj przypomnienie i napisy końcowe." },
                    { href: "/admin/library", icon: FolderOpen, title: "Zarządzaj biblioteką", text: "Sprawdź odcinki i zdecyduj, kto może je oglądać." },
                ].map(({ href, icon: Icon, title, text }) => <Link key={href} href={href} className={s.shortcut}>
                    <Icon size={22} className="text-nx-text-2" aria-hidden="true" /><div><strong>{title}</strong><p>{text}</p></div><ArrowRight size={18} aria-hidden="true" />
                </Link>)}
            </div>
            <dl className={s.overviewStats}>
                <div><dt>Tytuły w bibliotece</dt><dd>{seriesCount ?? "Brak danych"}</dd></div>
                <div><dt>Gotowe odcinki i filmy</dt><dd>{episodeCount ?? "Brak danych"}</dd></div>
                <div><dt>Miejsce na pliki</dt><dd>{mediaStorageResult.kind === "success" ? formatB2Bytes(readyTotalBytes) : "Brak danych"}</dd></div>
                <div><dt>Konta</dt><dd>{userCount ?? "Brak danych"}</dd></div>
            </dl>

            <details className={s.details}>
                <summary>Statystyki wspólnego oglądania</summary>
                <div className="grid gap-5">

            <div className="max-w-3xl">
                <h2 className="font-display text-[24px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                    Synchronizacja odtwarzania
                </h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">
                    Dane z ostatnich 30 dni pokazują, jak często odtwarzacze musiały korygować różnice w czasie oglądania.
                </p>
            </div>

            {partyTelemetryResult.kind !== "error" ? (
                <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <StatTile
                            label="Sesje uczestników"
                            value={formatInteger(partyTelemetryResult.data.sessions)}
                            detail={`${formatInteger(partyTelemetryResult.data.syncedSessions)} z pomiarem synchronizacji`}
                        />
                        <StatTile
                            label="Korekty pozycji filmu"
                            value={formatInteger(partyTelemetryResult.data.hardSeeks)}
                            detail={`${formatDecimal(partyTelemetryResult.data.hardSeeksPerSession)} na sesję`}
                        />
                        <StatTile
                            label="Śr. czas synchronizacji"
                            value={partyTelemetryResult.data.averageTimeToSyncMs === null
                                ? null
                                : formatSeconds(partyTelemetryResult.data.averageTimeToSyncMs)}
                            detail={partyTelemetryResult.data.maximumTimeToSyncMs === null
                                ? undefined
                                : `Najdłużej: ${formatSeconds(partyTelemetryResult.data.maximumTimeToSyncMs)}`}
                        />
                        <StatTile
                            label="Przekroczony czas buforowania"
                            value={formatInteger(partyTelemetryResult.data.buffering.timedOut)}
                            detail={`${formatInteger(partyTelemetryResult.data.buffering.cycles)} cykli, ${formatInteger(partyTelemetryResult.data.buffering.recovered)} wznowień`}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                        {[
                            ["Dryf <0,25 s", 0], ["Dryf <0,5 s", 1], ["Dryf <1 s", 2],
                            ["Dryf ≤2 s", 3], ["Dryf >2 s", 4],
                        ].map(([label, index]) => (
                            <StatTile
                                key={String(label)}
                                label={String(label)}
                                value={partyTelemetryResult.data.driftSamples === 0
                                    ? "0,0%"
                                    : `${formatDecimal(
                                        ((partyTelemetryResult.data.driftBuckets[Number(index)] ?? 0)
                                            / partyTelemetryResult.data.driftSamples) * 100,
                                        1,
                                    )}%`}
                                detail={`${formatInteger(partyTelemetryResult.data.driftBuckets[Number(index)] ?? 0)} próbek`}
                            />
                        ))}
                    </div>
                </>
            ) : (
                <DataErrorState reason={partyTelemetryResult.reason} compact />
            )}

                </div>
            </details>
            <details className={s.details} open={failedAssets.length > 0}>
                <summary>Stan magazynu plików{failedAssets.length > 0 ? `: ${failedAssets.length} z błędami` : ""}</summary>
                <div className="grid gap-5">
            <div className="max-w-3xl">
                <h2 className="font-display text-[24px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                    Pliki wideo
                </h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">
                    Stan przygotowania plików do oglądania i zajęte miejsce w magazynie.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Gotowe do oglądania" value={readyAssets.length} />
                <StatTile label="W trakcie" value={processingAssets.length} />
                <StatTile label="Wymagają poprawy" value={failedAssets.length} />
                <StatTile label="Rekordy usunięte" value={deletedAssets.length} />
                <StatTile label="Rozmiar w B2" value={formatB2Bytes(readyTotalBytes)} />
                <StatTile
                    label="Szac. koszt / mies."
                    value={`$${estimatedMonthlyCost.toFixed(2)}`}
                    detail="Po odjęciu darmowego limitu 10 GB"
                />
                <StatTile
                    label="Ostatnia weryfikacja"
                    value={lastVerification ? lastVerification.ranAt : "brak"}
                />
                <StatTile
                    label="Wynik ostatniej weryfikacji"
                    value={lastVerification ? `${lastVerification.checkedCount - lastVerification.failedCount}/${lastVerification.checkedCount} OK` : "Brak"}
                />
            </div>

            {failedAssets.length > 0 && (
                <div className="max-w-3xl">
                    <h3 className="font-display text-[18px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                        Pliki z błędami
                    </h3>
                    <ul className="mt-3 grid gap-2 text-sm leading-6 text-nx-text-2">
                        {failedAssets.map((asset) => (
                            <li
                                key={`${asset.seriesKey}/${asset.episodeKey}`}
                                className="rounded-[var(--r-m)] border border-nx-border bg-nx-panel px-4 py-3"
                            >
                                <span className="text-nx-text">{asset.seriesKey}/{asset.episodeKey}</span>
                                {asset.errorMessage && (
                                    <span className="mt-1 block text-xs text-nx-critical">{asset.errorMessage}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

                </div>
            </details>
            {(libraryResult.kind === "error" || usersResult.kind === "error" || mediaStorageResult.kind === "error") && (
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
                    {mediaStorageResult.kind === "error" && (
                        <section aria-label="Błąd danych magazynu B2">
                            <DataErrorState reason={mediaStorageResult.reason} compact />
                        </section>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminOverviewPage;
