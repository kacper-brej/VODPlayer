import type { ImageLoader } from "next/image";

export type ArtworkRole = "hero" | "catalog" | "poster" | "episode" | "logo";

export const ARTWORK_SIZES: Record<ArtworkRole, string> = {
    hero: "100vw",
    catalog: "(max-width: 639px) 82vw, (max-width: 1023px) 48vw, (max-width: 1439px) 31vw, 24vw",
    poster: "(max-width: 639px) 34vw, (max-width: 1023px) 23vw, (max-width: 1279px) 19vw, (max-width: 1439px) 16vw, 14vw",
    episode: "(max-width: 390px) 116px, (max-width: 1024px) 205px, (max-width: 1280px) 165px, 189px",
    logo: "(max-width: 639px) 72vw, 520px",
};

const tmdbSize = (role: ArtworkRole, width: number) => {
    if (role === "hero") return width <= 780 ? "w780" : width <= 1280 ? "w1280" : "original";
    if (role === "poster") {
        if (width <= 185) return "w185";
        if (width <= 342) return "w342";
        if (width <= 500) return "w500";
        return "w780";
    }
    if (role === "episode") return width <= 185 ? "w185" : "w300";
    if (role === "logo") return width <= 300 ? "w300" : width <= 500 ? "w500" : "original";
    return width <= 300 ? "w300" : width <= 780 ? "w780" : "w1280";
};

const loaderFor = (role: ArtworkRole): ImageLoader => ({ src, width }) => {
    if (!src.startsWith("https://image.tmdb.org/t/p/")) return src;
    return src.replace(/\/t\/p\/(?:w\d+|original)\//, `/t/p/${tmdbSize(role, width)}/`);
};

export const ARTWORK_LOADERS: Record<ArtworkRole, ImageLoader> = {
    hero: loaderFor("hero"),
    catalog: loaderFor("catalog"),
    poster: loaderFor("poster"),
    episode: loaderFor("episode"),
    logo: loaderFor("logo"),
};

export const imageLoader = (src: string, role: ArtworkRole) =>
    src.startsWith("https://image.tmdb.org/t/p/") ? ARTWORK_LOADERS[role] : undefined;

export const safeArtworkColor = (value: string | null | undefined) =>
    value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;

export const blurProps = (value: string | null | undefined) =>
    value?.startsWith("data:image/")
        ? { placeholder: "blur" as const, blurDataURL: value }
        : {};

export const resolveArtwork = ({
    poster,
    backdrop,
    logo,
}: {
    poster: string | null;
    backdrop: string | null;
    logo?: string | null;
}) => ({
    poster,
    backdrop,
    logo: logo ?? null,
});
