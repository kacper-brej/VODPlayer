import { DataErrorState } from "@/components/data/DataState";
import { getAdminLibraryAction, getAdminUsersAction, getPartyTelemetryAction } from "@/lib/admin/adminActions";
import { getMediaStorageStatus } from "@/lib/admin/mediaStorageStatus";

const B2_ESTIMATED_COST_PER_GB_MONTH_USD = 0.006;

const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

const estimateMonthlyCostUsd = (totalBytes: number): number =>
    (totalBytes / 1024 ** 3) * B2_ESTIMATED_COST_PER_GB_MONTH_USD;

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
    const totalBytes =
        libraryResult.kind === "success"
            ? libraryResult.data.series.reduce((total, item) => total + item.totalBytes, 0)
            : null;
    const userCount = usersResult.kind === "success" ? usersResult.data.users.length : null;

    const mediaAssets = mediaStorageResult.kind === "success" ? mediaStorageResult.data.assets : [];
    const readyAssets = mediaAssets.filter((asset) => asset.status === "ready");
    const processingAssets = mediaAssets.filter((asset) => asset.status === "pending" || asset.status === "processing");
    const failedAssets = mediaAssets.filter((asset) => asset.status === "failed" || asset.status === "delete_failed");
    const readyTotalBytes = readyAssets.reduce((total, asset) => total + (asset.totalSizeBytes ?? 0), 0);
    const estimatedMonthlyCost = estimateMonthlyCostUsd(readyTotalBytes);
    const episodesWithoutAsset = episodeCount !== null ? Math.max(0, episodeCount - mediaAssets.length) : null;
    const lastVerification = mediaStorageResult.kind === "success" ? mediaStorageResult.data.lastVerification : null;

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
                    Widok obejmuje bibliotekę HLS i grafiki przechowywane w Backblaze B2.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Seriale" value={seriesCount} />
                <StatTile label="Odcinki" value={episodeCount} />
                <StatTile label="Rozmiar biblioteki (B2)" value={totalBytes !== null ? formatBytes(totalBytes) : null} />
                <StatTile label="Konta" value={userCount} />
            </div>

            <div className="max-w-3xl">
                <h2 className="font-display text-[24px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                    Zdrowie wspólnego oglądania
                </h2>
                <p className="mt-2 text-sm leading-6 text-nx-text-2">
                    Anonimowe agregaty z ostatnich 30 dni. Rozkład dryfu nie zawiera nazw profili ani treści czatu.
                </p>
            </div>

            {partyTelemetryResult.kind !== "error" ? (
                <>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <StatTile label="Sesje uczestników" value={partyTelemetryResult.data.sessions} />
                        <StatTile label="Twarde seeki / sesję" value={partyTelemetryResult.data.hardSeeksPerSession.toFixed(2)} />
                        <StatTile
                            label="Śr. czas do zgrania"
                            value={partyTelemetryResult.data.averageTimeToSyncMs === null
                                ? null
                                : `${(partyTelemetryResult.data.averageTimeToSyncMs / 1000).toFixed(2)} s`}
                        />
                        <StatTile
                            label="Pauzy: timeout"
                            value={`${partyTelemetryResult.data.buffering.timedOut}/${partyTelemetryResult.data.buffering.cycles}`}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                        {[
                            ["Dryf <0,25 s", 0], ["Dryf <0,5 s", 1], ["Dryf <1 s", 2],
                            ["Dryf ≤2 s", 3], ["Dryf >2 s", 4],
                        ].map(([label, index]) => (
                            <StatTile key={String(label)} label={String(label)} value={partyTelemetryResult.data.driftBuckets[Number(index)] ?? 0} />
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
                    Stan aktywnych assetów HLS w B2 — narzędzia operatora:{" "}
                    <code className="text-nx-text">tools/transcode</code> po stronie operatora.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Gotowe (ready)" value={readyAssets.length} />
                <StatTile label="W trakcie" value={processingAssets.length} />
                <StatTile label="Niepowodzenia (failed)" value={failedAssets.length} />
                <StatTile label="Odcinki bez assetu" value={episodesWithoutAsset} />
                <StatTile label="Rozmiar w B2" value={formatBytes(readyTotalBytes)} />
                <StatTile label="Szac. koszt / mies." value={`$${estimatedMonthlyCost.toFixed(2)}`} />
                <StatTile
                    label="Ostatnia weryfikacja"
                    value={lastVerification ? lastVerification.ranAt : "brak"}
                />
                <StatTile
                    label="Wynik ostatniej weryfikacji"
                    value={lastVerification ? `${lastVerification.checkedCount - lastVerification.failedCount}/${lastVerification.checkedCount} OK` : "—"}
                />
            </div>

            {failedAssets.length > 0 && (
                <div className="max-w-3xl">
                    <h3 className="font-display text-[18px] leading-[1.1] tracking-[-0.02em] text-nx-text">
                        Assety failed
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
