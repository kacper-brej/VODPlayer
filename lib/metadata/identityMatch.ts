import type { SeriesCandidate } from "@/lib/metadata/types";

export const normalizeTitleForMatch = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/\p{Mark}/gu, "")
        .toLowerCase()
        .replace(/[;:√·\-.,!?]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const candidateTitleVariants = (candidate: SeriesCandidate): string[] =>
    Array.from(new Set(
        [candidate.title, ...candidate.altTitles].filter((title): title is string => Boolean(title && title.trim())),
    ));

export const findConfidentMatch = (folderTitle: string, candidates: SeriesCandidate[]): SeriesCandidate | null => {
    const normalizedFolder = normalizeTitleForMatch(folderTitle);

    return candidates.find((candidate) =>
        candidateTitleVariants(candidate).some((title) => normalizeTitleForMatch(title) === normalizedFolder),
    ) ?? null;
};
