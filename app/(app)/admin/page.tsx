import Link from "next/link";
import { HardDriveDownload } from "lucide-react";
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
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-16">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
                <div className="max-w-3xl">
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-nx-accent">
                        Przegląd
                    </p>
                    <h1 className="mt-2 font-display text-[36px] leading-[1.05] tracking-[-0.03em] text-nx-text sm:text-[42px]">
                        Panel administracyjny
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-nx-text-2">
                        Liczniki pokazują gotowe odcinki katalogu oraz stan assetów HLS w Backblaze B2.
                    </p>
                </div>
                <Link
                    href="/admin/library-scan"
                    className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent outline-none transition-[filter] duration-140 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                >
                    <HardDriveDownload aria-hidden="true" className="size-4" />
                    Skanuj pliki na serwerze
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Seriale z gotowym odcinkiem" value={seriesCount} />
                <StatTile label="Gotowe odcinki" value={episodeCount} />
                <StatTile label="Rozmiar gotowych HLS" value={mediaStorageResult.kind === "success" ? formatB2Bytes(readyTotalBytes) : null} />
                <StatTile label="Konta" value={userCount} />
            </div>

            <div className="max-w-3xl">
                <h2 className="font-display text-[24px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                    Zdrowie wspólnego oglądania
                </h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">
                    Anonimowe agregaty z ostatnich 30 dni. Sesja oznacza raport jednego uczestnika, a rozkład dryfu pokazuje udział próbek odtwarzacza.
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
                            label="Twarde seeki"
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
                            label="Timeouty buforowania"
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

            <div className="max-w-3xl">
                <h2 className="font-display text-[24px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                    Stan magazynu B2
                </h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">
                    Aktywne assety HLS zapisane w B2. Do obsługi transkodowania służy{" "}
                    <code className="text-nx-text">tools/transcode</code>.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Gotowe (ready)" value={readyAssets.length} />
                <StatTile label="W trakcie" value={processingAssets.length} />
                <StatTile label="Niepowodzenia (failed)" value={failedAssets.length} />
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
                        Assety z błędami
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
