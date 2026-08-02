import type { TmdbImage } from "@/lib/contracts";
import type { ProviderArtwork } from "@/lib/metadata/types";

const MAX_CANDIDATES_PER_KIND = 5;
const LOGO_MIN_ASPECT = 1.5;
const LOGO_MAX_ASPECT = 6;

const languageRank = (iso: string | null, order: (string | null)[]): number => {
    const index = order.indexOf(iso);
    return index === -1 ? order.length : index;
};

const rankBackdrops = (images: TmdbImage[]): TmdbImage[] =>
    [...images].sort((a, b) => {
        const noTextA = a.iso_639_1 === null ? 0 : 1;
        const noTextB = b.iso_639_1 === null ? 0 : 1;
        if (noTextA !== noTextB) return noTextA - noTextB;
        if (b.width !== a.width) return b.width - a.width;
        return b.vote_average - a.vote_average;
    });

const rankPosters = (images: TmdbImage[]): TmdbImage[] => {
    const order: (string | null)[] = ["pl", "en", "ja", null];

    return [...images].sort((a, b) => {
        const langA = languageRank(a.iso_639_1, order);
        const langB = languageRank(b.iso_639_1, order);
        if (langA !== langB) return langA - langB;
        const meetsMinA = a.width >= 600 ? 0 : 1;
        const meetsMinB = b.width >= 600 ? 0 : 1;
        if (meetsMinA !== meetsMinB) return meetsMinA - meetsMinB;
        return b.vote_average - a.vote_average;
    });
};

const rankLogos = (images: TmdbImage[]): TmdbImage[] => {
    const order: (string | null)[] = ["pl", "en", "ja"];

    return images
        .filter((image) => {
            const ratio = image.width / image.height;
            return ratio >= LOGO_MIN_ASPECT && ratio <= LOGO_MAX_ASPECT;
        })
        .sort((a, b) => {
            const langA = languageRank(a.iso_639_1, order);
            const langB = languageRank(b.iso_639_1, order);
            if (langA !== langB) return langA - langB;
            const alphaA = a.file_path.toLowerCase().endsWith(".png") ? 0 : 1;
            const alphaB = b.file_path.toLowerCase().endsWith(".png") ? 0 : 1;
            if (alphaA !== alphaB) return alphaA - alphaB;
            return b.vote_average - a.vote_average;
        });
};

const toArtwork = (
    images: TmdbImage[],
    kind: ProviderArtwork["kind"],
    baseUrl: string,
): ProviderArtwork[] =>
    images.slice(0, MAX_CANDIDATES_PER_KIND).map((image) => ({
        kind,
        url: `${baseUrl}original${image.file_path}`,
        width: image.width,
        height: image.height,
        language: image.iso_639_1,
    }));

export const rankTmdbArtwork = (
    images: { backdrops: TmdbImage[]; posters: TmdbImage[]; logos: TmdbImage[] },
    baseUrl: string,
): ProviderArtwork[] => [
    ...toArtwork(rankBackdrops(images.backdrops), "backdrop", baseUrl),
    ...toArtwork(rankPosters(images.posters), "poster", baseUrl),
    ...toArtwork(rankLogos(images.logos), "logo", baseUrl),
];
