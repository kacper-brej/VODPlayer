import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import type { ProviderArtwork, ProviderId, ProviderSeries } from "@/lib/metadata/types";
import { persistSeriesMetadata, toLegacyMetadata } from "@/lib/seriesMetadata";

type TitleKind = "primary" | "romaji" | "english" | "native" | "synonym";
type ArtworkPrimaryPolicy = "force" | "if-absent" | "never";

const identityProviderFor = (providerId: ProviderId): string =>
    providerId === "jikan" ? "mal" : providerId;

const ARTWORK_PRIMARY_POLICY: Record<ProviderId, Exclude<ArtworkPrimaryPolicy, "never">> = {
    tmdb: "force",
    anilist: "if-absent",
    jikan: "if-absent",
};

export const postSeriesMetadata = async (headers: Record<string, string>, body: unknown): Promise<boolean> => {
    try {
        const res = await fetch(`${VOD_ORIGIN}/series-metadata.php`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
        });

        if (!res.ok) return false;

        const payload: unknown = await res.json().catch(() => null);
        return Boolean(payload) && typeof payload === "object" && (payload as { success?: unknown }).success === true;
    } catch (error) {
        console.error("series-metadata persist failed", error);
        return false;
    }
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
    const headers = await sessionHeaders();
    if (!headers) return false;

    const externalIdWrites = [
        postSeriesMetadata(headers, {
            seriesKey,
            provider: identityProviderFor(providerId),
            externalId,
            matchSource,
        }),
    ];

    if (series.malId !== null && providerId !== "jikan") {
        externalIdWrites.push(postSeriesMetadata(headers, {
            seriesKey,
            provider: "mal",
            externalId: String(series.malId),
            matchSource,
        }));
    }

    const titlesWrite = postSeriesMetadata(headers, { seriesKey, titles: buildTitles(seriesKey, series) });

    const artworkItems = buildArtworkPayload(providerId, artwork, matchSource);
    const artworkWrite = artworkItems.length > 0
        ? postSeriesMetadata(headers, { seriesKey, artwork: artworkItems })
        : Promise.resolve(true);

    const descriptiveWrite = persistSeriesMetadata(seriesKey, toLegacyMetadata(providerId, externalId, series, artwork));

    const results = await Promise.all([...externalIdWrites, titlesWrite, artworkWrite, descriptiveWrite]);

    return results.every(Boolean);
};
