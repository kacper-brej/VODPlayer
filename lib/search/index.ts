export const CLIENT_SEARCH_LIMIT = 1000;

export interface SearchRecord {
    key: string;
    title: string;
    altTitles: string[];
    inWatchlist?: boolean;
    hasProgress?: boolean;
}

export interface SearchRange {
    start: number;
    end: number;
}

interface NormalizedText {
    value: string;
    starts: number[];
    ends: number[];
}

interface SearchCandidate extends NormalizedText {
    original: string;
    kind: "title" | "alternative";
}

export type PreparedSearchEntry<T extends SearchRecord = SearchRecord> = T & {
    searchCandidates: SearchCandidate[];
};

export interface SearchResult<T extends SearchRecord = SearchRecord> {
    entry: PreparedSearchEntry<T>;
    score: number;
    fuzzy: boolean;
    matchedTitle: string;
    matchedKind: "title" | "alternative";
    ranges: SearchRange[];
}

const normalizeWithMap = (input: string): NormalizedText => {
    const chars: { value: string; start: number; end: number }[] = [];
    let offset = 0;

    for (const originalChar of input) {
        const start = offset;
        offset += originalChar.length;
        const decomposed = originalChar
            .toLocaleLowerCase("pl")
            .replace(/ł/g, "l")
            .normalize("NFD")
            .replace(/\p{M}/gu, "");

        for (const char of decomposed) {
            const value = /[\p{L}\p{N}]/u.test(char) ? char : " ";
            chars.push({ value, start, end: offset });
        }
    }

    const collapsed: typeof chars = [];

    for (const char of chars) {
        if (char.value === " ") {
            if (collapsed.length === 0 || collapsed[collapsed.length - 1].value === " ") continue;
        }
        collapsed.push(char);
    }

    while (collapsed[collapsed.length - 1]?.value === " ") collapsed.pop();

    return {
        value: collapsed.map((char) => char.value).join(""),
        starts: collapsed.map((char) => char.start),
        ends: collapsed.map((char) => char.end),
    };
};

export const normalizeSearchText = (input: string) => normalizeWithMap(input).value;

export const prepareSearchEntries = <T extends SearchRecord>(entries: T[]): PreparedSearchEntry<T>[] =>
    entries.map((entry) => {
        const titles = [entry.title, ...entry.altTitles]
            .filter((title, index, values) => title.trim() && values.findIndex((value) => value.localeCompare(title, "pl", { sensitivity: "accent" }) === 0) === index);

        return {
            ...entry,
            searchCandidates: titles.map((title, index) => ({
                original: title,
                kind: index === 0 ? "title" : "alternative",
                ...normalizeWithMap(title),
            })),
        };
    });

const typoThreshold = (length: number) => length <= 3 ? 0 : length <= 6 ? 1 : 2;

export const damerauLevenshteinWithin = (left: string, right: string, limit: number): number | null => {
    if (Math.abs(left.length - right.length) > limit) return null;
    if (left === right) return 0;

    const width = right.length + 1;
    let previousPrevious = Array<number>(width).fill(Number.POSITIVE_INFINITY);
    let previous = Array.from({ length: width }, (_, index) => index);

    for (let i = 1; i <= left.length; i++) {
        const current = Array<number>(width).fill(Number.POSITIVE_INFINITY);
        current[0] = i;
        const from = Math.max(1, i - limit);
        const to = Math.min(right.length, i + limit);
        let rowMinimum = Number.POSITIVE_INFINITY;

        for (let j = from; j <= to; j++) {
            const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
            const insertion = current[j - 1] + 1;
            const deletion = previous[j] + 1;
            let value = Math.min(substitution, insertion, deletion);

            if (
                i > 1
                && j > 1
                && left[i - 1] === right[j - 2]
                && left[i - 2] === right[j - 1]
            ) {
                value = Math.min(value, previousPrevious[j - 2] + 1);
            }

            current[j] = value;
            rowMinimum = Math.min(rowMinimum, value);
        }

        if (rowMinimum > limit) return null;
        previousPrevious = previous;
        previous = current;
    }

    return previous[right.length] <= limit ? previous[right.length] : null;
};

const normalizedWords = (value: string) => {
    const words: { value: string; start: number; end: number }[] = [];
    const pattern = /[^ ]+/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
        words.push({ value: match[0], start: match.index, end: match.index + match[0].length });
    }

    return words;
};

const originalRanges = (candidate: SearchCandidate, normalizedRanges: SearchRange[]): SearchRange[] => {
    const ranges = normalizedRanges
        .map(({ start, end }) => ({
            start: candidate.starts[start] ?? 0,
            end: candidate.ends[Math.max(start, end - 1)] ?? candidate.original.length,
        }))
        .sort((a, b) => a.start - b.start);
    const merged: SearchRange[] = [];

    for (const range of ranges) {
        const previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
        else merged.push({ ...range });
    }

    return merged;
};

const matchCandidate = (candidate: SearchCandidate, query: string) => {
    if (candidate.value === query) {
        return { score: 500, fuzzy: false, ranges: [{ start: 0, end: query.length }] };
    }

    if (candidate.value.startsWith(query)) {
        return { score: 400, fuzzy: false, ranges: [{ start: 0, end: query.length }] };
    }

    const words = normalizedWords(candidate.value);
    const wordPrefix = words.find((word) => word.value.startsWith(query));
    if (wordPrefix) {
        return { score: 300, fuzzy: false, ranges: [{ start: wordPrefix.start, end: wordPrefix.start + query.length }] };
    }

    const substringStart = candidate.value.indexOf(query);
    if (substringStart >= 0) {
        return { score: 200, fuzzy: false, ranges: [{ start: substringStart, end: substringStart + query.length }] };
    }

    const queryWords = normalizedWords(query);
    if (queryWords.length === 0) return null;

    let totalDistance = 0;
    const ranges: SearchRange[] = [];

    for (const queryWord of queryWords) {
        const limit = typoThreshold(queryWord.value.length);
        let best: { distance: number; start: number; end: number } | null = null;

        for (const word of words) {
            const distance = damerauLevenshteinWithin(queryWord.value, word.value, limit);
            if (distance === null || (best && distance >= best.distance)) continue;
            best = { distance, start: word.start, end: word.end };
        }

        if (!best) return null;
        totalDistance += best.distance;
        ranges.push({ start: best.start, end: best.end });
    }

    return { score: 100 - totalDistance * 5, fuzzy: true, ranges };
};

export const searchEntries = <T extends SearchRecord>(entries: PreparedSearchEntry<T>[], rawQuery: string): SearchResult<T>[] => {
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];

    const results = entries.flatMap((entry) => {
        let best: SearchResult<T> | null = null;

        for (const candidate of entry.searchCandidates) {
            const match = matchCandidate(candidate, query);
            if (!match) continue;

            const result: SearchResult<T> = {
                entry,
                score: match.score,
                fuzzy: match.fuzzy,
                matchedTitle: candidate.original,
                matchedKind: candidate.kind,
                ranges: originalRanges(candidate, match.ranges),
            };

            if (!best || result.score > best.score || (result.score === best.score && result.matchedKind === "title")) {
                best = result;
            }
        }

        return best ? [best] : [];
    });

    return results.sort((left, right) =>
        right.score - left.score
        || Number(Boolean(right.entry.inWatchlist)) - Number(Boolean(left.entry.inWatchlist))
        || Number(Boolean(right.entry.hasProgress)) - Number(Boolean(left.entry.hasProgress))
        || left.entry.title.length - right.entry.title.length
        || left.entry.title.localeCompare(right.entry.title, "pl")
    );
};
