import { anilistProvider } from "@/lib/metadata/providers/anilist";
import { jikanProvider } from "@/lib/metadata/providers/jikan";
import { tmdbProvider } from "@/lib/metadata/providers/tmdb";
import { findConfidentMatch } from "@/lib/metadata/identityMatch";
import type {
    MetadataProvider,
    ProviderArtwork,
    ProviderId,
    ProviderSeries,
    SeriesCandidate,
} from "@/lib/metadata/types";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

const registry = new Map<ProviderId, MetadataProvider>([
    ["anilist", anilistProvider],
    ["jikan", jikanProvider],
    ["tmdb", tmdbProvider],
]);

export const getProvider = (id: ProviderId): MetadataProvider | undefined => registry.get(id);

export const listProviders = (): MetadataProvider[] => Array.from(registry.values());

const IDENTITY_FALLBACK_ORDER: MetadataProvider[] = [anilistProvider, jikanProvider];

export const searchIdentityCandidates = async (query: string): Promise<DataResult<SeriesCandidate[]>> => {
    let lastError: DataResult<SeriesCandidate[]> | null = null;

    for (const provider of IDENTITY_FALLBACK_ORDER) {
        const result = await provider.searchSeries(query);
        if (result.kind !== "error") return result;
        lastError = result;
    }

    return lastError ?? dataFailure("server");
};

export type IdentityMatch =
    | {
        kind: "matched";
        providerId: ProviderId;
        externalId: string;
        series: ProviderSeries;
        artwork: ProviderArtwork[];
    }
    | { kind: "ambiguous"; candidates: SeriesCandidate[] }
    | { kind: "not-found" };

const attemptIdentity = async (
    provider: MetadataProvider,
    folderTitle: string,
): Promise<DataResult<IdentityMatch>> => {
    const searchResult = await provider.searchSeries(folderTitle);
    if (searchResult.kind === "error") return searchResult;

    const candidates = searchResult.data;
    if (candidates.length === 0) return dataEmpty({ kind: "not-found" });

    const match = findConfidentMatch(folderTitle, candidates);
    if (!match) return dataSuccess({ kind: "ambiguous", candidates });

    if (!provider.getArtwork) return dataFailure("server");

    const [seriesResult, artworkResult] = await Promise.all([
        provider.getSeries(match.externalId),
        provider.getArtwork(match.externalId),
    ]);

    if (seriesResult.kind === "error") return seriesResult;
    if (artworkResult.kind === "error") return artworkResult;

    return dataSuccess({
        kind: "matched",
        providerId: provider.id,
        externalId: match.externalId,
        series: seriesResult.data,
        artwork: artworkResult.data,
    });
};

export const resolveSeriesIdentity = async (folderTitle: string): Promise<DataResult<IdentityMatch>> => {
    let lastResult: DataResult<IdentityMatch> | null = null;

    for (const provider of IDENTITY_FALLBACK_ORDER) {
        const result = await attemptIdentity(provider, folderTitle);
        lastResult = result;
        if (result.kind !== "error") return result;
    }

    return lastResult ?? dataFailure("server");
};
