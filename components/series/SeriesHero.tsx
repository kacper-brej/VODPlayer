"use client";

import Image from "next/image";
import { Play, Star, Users } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { partyWatchPath, watchPath } from "@/lib/core/routes";
import { ARTWORK_SIZES, blurProps, imageLoader, safeArtworkColor } from "@/lib/catalog/imageDelivery";
import { startPartyForEpisode } from "@/lib/party/startPartyForEpisode";

interface SeriesHeroProps {
    seriesId: number;
    seriesKey: string;
    title: string;
    backdropImage: string | null;
    logoImage: string | null;
    placeholder: string | null;
    synopsis: string | null;
    year: number | null;
    rating: string | null;
    ageRating: string | null;
    episodeCount: number;
    resumeEpisodeKey: string | null;
    resumeEpisodeNumber: number | null;
    firstEpisodeKey: string | null;
    dominantColor: string | null;
    focalX: number | null;
    focalY: number | null;
    safeLeft: number | null;
    safeBottom: number | null;
}

const SeriesHero = ({
    seriesId,
    seriesKey,
    title,
    backdropImage,
    logoImage,
    placeholder,
    synopsis,
    year,
    rating,
    ageRating,
    episodeCount,
    resumeEpisodeKey,
    resumeEpisodeNumber,
    firstEpisodeKey,
    dominantColor,
    focalX,
    focalY,
    safeLeft,
    safeBottom,
}: SeriesHeroProps) => {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [imageStep, setImageStep] = useState(backdropImage ? 1 : dominantColor ? 2 : 3);
    const [logoFailed, setLogoFailed] = useState(false);
    const [notice, setNotice] = useState("");
    const [startingParty, setStartingParty] = useState(false);
    const activeEpisodeKey = resumeEpisodeKey ?? firstEpisodeKey;
    const hasBackdrop = imageStep === 1 && backdropImage;
    const safeColor = safeArtworkColor(dominantColor);
    const copyWidth = Math.min(0.9, Math.max(0.35, safeLeft ?? 0.52));
    const copyBottom = Math.min(0.7, Math.max(0.3, safeBottom ?? 0.42));
    const hasMetadata = Boolean(year || rating || ageRating || episodeCount > 0);

    const play = () => {
        if (!activeEpisodeKey) {
            setNotice("Ten tytuł nie ma jeszcze odcinków.");
            return;
        }
        router.push(watchPath(seriesId, activeEpisodeKey));
    };

    const watchTogether = async () => {
        if (!activeEpisodeKey) {
            setNotice("Ten tytuł nie ma jeszcze odcinków.");
            return;
        }
        setStartingParty(true);
        const result = await startPartyForEpisode(seriesKey, activeEpisodeKey);
        setStartingParty(false);
        if (!result.ok || !result.code) {
            setNotice(result.error ?? "Nie udało się utworzyć pokoju.");
            return;
        }
        router.push(partyWatchPath(seriesId, activeEpisodeKey, result.code));
    };

    const failImage = () => {
        if (safeColor) setImageStep(2);
        else setImageStep(3);
    };

    return (
        <section
            aria-labelledby="series-title"
            className="relative min-h-[46vh] overflow-hidden bg-nx-panel sm:min-h-[520px] lg:min-h-[52vh] xl:min-h-[58vh] 2xl:min-h-[62vh] 2xl:max-h-[760px]"
            style={imageStep === 2 && safeColor ? { backgroundColor: safeColor } : undefined}
        >
            {hasBackdrop && (
                <Image
                    src={backdropImage}
                    alt=""
                    fill
                    preload
                    sizes={ARTWORK_SIZES.hero}
                    loader={imageLoader(backdropImage, "hero")}
                    {...blurProps(placeholder)}
                    className="object-cover transition-opacity duration-300 motion-reduce:transition-none"
                    style={{ objectPosition: `${Math.round((focalX ?? 0.62) * 100)}% ${Math.round((focalY ?? 0.4) * 100)}%` }}
                    onError={failImage}
                />
            )}

            {imageStep === 3 && (
                <div className="absolute right-6 top-6 font-mono text-[10px] tracking-[0.2em] text-nx-text-2">
                    BRAK MATERIAŁU GRAFICZNEGO
                </div>
            )}

            <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--nx-bg)_0%,color-mix(in_srgb,var(--nx-bg)_92%,transparent)_38%,transparent_76%)] lg:w-[82%]" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--nx-bg)_0%,color-mix(in_srgb,var(--nx-bg)_76%,transparent)_24%,transparent_66%)]" />

            <div className="relative z-10 mx-auto grid min-h-[46vh] w-full max-w-[1440px] grid-cols-4 items-end gap-x-4 px-5 pb-12 sm:min-h-[520px] sm:px-8 lg:min-h-[52vh] lg:grid-cols-12 lg:gap-x-5 lg:px-10 lg:pb-14 xl:min-h-[58vh] xl:px-11 2xl:min-h-[62vh] 2xl:max-h-[760px] 2xl:px-12">
                <div
                    className="col-span-4 max-w-full md:max-w-[var(--nx-hero-copy-w)] lg:col-span-8 xl:col-span-7"
                    style={{
                        "--nx-hero-copy-w": `min(46ch, ${Math.round(copyWidth * 100)}vw)`,
                        paddingBottom: `${Math.round((copyBottom - 0.3) * 24)}px`,
                    } as CSSProperties}
                >
                    <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-nx-text-2 lg:text-[10.5px] xl:text-[11px]">
                        {resumeEpisodeKey ? "KONTYNUUJ OGLĄDANIE" : "OD POCZĄTKU"}
                    </p>
                    <h1 id="series-title">
                        {logoImage && !logoFailed ? (
                            <span className="relative block h-20 w-full max-w-[520px] sm:h-24 lg:h-30">
                                <Image
                                    src={logoImage}
                                    alt={title}
                                    fill
                                    sizes={ARTWORK_SIZES.logo}
                                    loader={imageLoader(logoImage, "logo")}
                                    onError={() => setLogoFailed(true)}
                                    className="object-contain object-left"
                                />
                            </span>
                        ) : (
                            <span className="font-display text-[34px] leading-none tracking-[-0.02em] text-nx-text sm:text-[42px] lg:text-[54px] lg:tracking-[-0.035em] xl:text-[66px] 2xl:text-[76px] 2xl:tracking-[-0.045em]">
                                {title}
                            </span>
                        )}
                    </h1>

                    {hasMetadata && (
                        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] tracking-[0.16em] text-nx-text-2 lg:text-[10.5px] xl:text-[11px]">
                            {year && <span>{year}</span>}
                            {rating && (
                                <span className="inline-flex items-center gap-1.5" aria-label={`Ocena ${rating}`}>
                                    <Star size={13} fill="currentColor" className="text-nx-accent" aria-hidden="true" />
                                    {rating}
                                </span>
                            )}
                            {ageRating && <span>{ageRating}</span>}
                            {episodeCount > 0 && <span>{episodeCount} odc.</span>}
                        </p>
                    )}

                    {synopsis && (
                        <div className="mt-5 max-w-[46ch]">
                            <p className={`text-[15px] leading-[1.65] text-nx-text-2 lg:text-[15.5px] xl:text-base ${expanded ? "" : "line-clamp-3 lg:line-clamp-4"}`}>
                                {synopsis}
                            </p>
                            {synopsis.length > 240 && (
                                <button
                                    type="button"
                                    onClick={() => setExpanded((value) => !value)}
                                    className="mt-2 text-sm text-nx-text underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                                    aria-expanded={expanded}
                                >
                                    {expanded ? "Zwiń" : "Rozwiń"}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                            type="button"
                            onClick={play}
                            aria-disabled={!activeEpisodeKey}
                            className={`flex h-12 items-center justify-center gap-2 rounded-xl bg-nx-accent px-6 text-[15px] font-semibold text-nx-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent xl:h-13 ${activeEpisodeKey ? "" : "opacity-45"}`}
                        >
                            <Play size={18} fill="currentColor" />
                            {resumeEpisodeKey && resumeEpisodeNumber
                                ? `Wznów odcinek ${resumeEpisodeNumber}`
                                : "Odtwórz odcinek 1"}
                        </button>
                        <button
                            type="button"
                            onClick={watchTogether}
                            disabled={startingParty}
                            aria-disabled={!activeEpisodeKey}
                            className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-nx-border bg-nx-panel/70 px-6 text-[15px] font-semibold text-nx-text transition-colors hover:border-nx-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent xl:h-13 ${activeEpisodeKey ? "" : "opacity-45"} ${startingParty ? "opacity-70" : ""}`}
                        >
                            <Users size={18} />
                            {startingParty ? "Tworzenie pokoju…" : "Oglądaj razem"}
                        </button>
                    </div>
                    <p className="mt-2 min-h-5 text-sm text-nx-text-2" aria-live="polite">{notice}</p>
                </div>
            </div>
        </section>
    );
};

export default SeriesHero;
