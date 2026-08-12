import type { ProviderArtwork, ProviderId, ProviderSeries } from "@/lib/metadata/types";
import { toLegacyMetadata } from "@/lib/catalog/seriesMetadata";
import { persistCompleteSeriesMetadata } from "@/lib/seriesMetadata/seriesMetadataService";
import type { ExternalIdProvider } from "@/lib/seriesMetadata/seriesMetadataContracts";

type TitleKind = "primary" | "romaji" | "english" | "native" | "synonym";
type ArtworkPrimaryPolicy = "force" | "if-absent" | "never";

const identityProviderFor = (providerId: ProviderId): ExternalIdProvider =>
    providerId === "jikan" ? "mal" : providerId;

const ARTWORK_PRIMARY_POLICY: Record<ProviderId, Exclude<ArtworkPrimaryPolicy, "never">> = {
    tmdb: "force",
    anilist: "if-absent",
    jikan: "if-absent",
};

const buildTitles = (seriesKey: string, series: ProviderSeries): { title: string; kind: TitleKind }[] => {
    const titles: { title: string; kind: TitleKind }[] = [{ title: seriesKey, kind: "primary" }];

    const addTitle = (title: string | null, kind: TitleKind) => {
        const trimmed = title?.trim();
        if (trimmed && trimmed !== seriesKey) titles.push({ title: trimmed, kind });
    };

    addTitle(series.titles.romaji, "romaji");
    addTitle(series.titles.english, "english");
    addTitle(series.titles.native, "native");
    series.synonyms.forEach((synonym) => addTitle(synonym, "synonym"));

    return Array.from(new Map(titles.map((entry) => [`${entry.kind}:${entry.title}`, entry])).values());
};

export const buildArtworkPayload = (
    providerId: ProviderId,
    artwork: ProviderArtwork[],
    matchSource: "auto" | "manual" = "auto",
) => {
    const policy = ARTWORK_PRIMARY_POLICY[providerId] ?? "never";
    const seenKinds = new Set<string>();

    return artwork.map((entry) => {
        const isBestForKind = !seenKinds.has(entry.kind);
        seenKinds.add(entry.kind);

        return {
            kind: entry.kind,
            url: entry.url,
            width: entry.width,
            height: entry.height,
            provider: providerId,
            language: entry.language,
            primary: (isBestForKind ? policy : "never") as ArtworkPrimaryPolicy,
            matchSource,
        };
    });
};

export const persistSeriesIdentity = async (
    seriesKey: string,
    providerId: ProviderId,
    externalId: string,
    series: ProviderSeries,
    artwork: ProviderArtwork[],
    matchSource: "auto" | "manual",
): Promise<boolean> => {
    const externalIds = [{ provider: identityProviderFor(providerId), externalId, matchSource }];

    if (series.malId !== null && providerId !== "jikan") {
        externalIds.push({ provider: "mal", externalId: String(series.malId), matchSource });
    }
    const descriptive = toLegacyMetadata(providerId, externalId, series, artwork);
    try {
        await persistCompleteSeriesMetadata({
            seriesKey,
            externalIds,
            titles: buildTitles(seriesKey, series),
            artwork: buildArtworkPayload(providerId, artwork, matchSource).map((item) => ({
                ...item,
                dominantColor: null,
                placeholder: null,
            })),
            cover: {
                title: seriesKey,
                ...descriptive,
                backdropSource: descriptive.backdropImage ? "jikan" : null,
                genres: descriptive.genres,
                studio: descriptive.studio,
            },
        });
        return true;
    } catch (error) {
        console.error("series metadata persist failed", error);
        return false;
    }
};
