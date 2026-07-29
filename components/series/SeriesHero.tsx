"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { watchPath } from "@/lib/routes";

interface SeriesHeroProps {
    seriesId: number;
    title: string;
    coverImage: string | null;
    backdropImage: string | null;
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
}

const SeriesHero = ({
    seriesId,
    title,
    coverImage,
    backdropImage,
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
}: SeriesHeroProps) => {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [imageStep, setImageStep] = useState(backdropImage ? 1 : coverImage ? 2 : dominantColor ? 3 : 4);
    const [notice, setNotice] = useState("");
    const activeEpisodeKey = resumeEpisodeKey ?? firstEpisodeKey;
    const hasBackdrop = imageStep === 1 && backdropImage;
    const hasPoster = imageStep <= 2 && coverImage;
    const metadata = [year, rating, ageRating, episodeCount > 0 ? `${episodeCount} odc.` : null].filter(Boolean);

    const play = () => {
        if (!activeEpisodeKey) {
            setNotice("Ten tytuł nie ma jeszcze odcinków.");
            return;
        }
        router.push(watchPath(seriesId, activeEpisodeKey));
    };

    const failImage = () => {
        if (imageStep === 1 && coverImage) setImageStep(2);
        else if (dominantColor) setImageStep(3);
        else setImageStep(4);
    };

    return (
        <section
            aria-labelledby="series-title"
            className="relative min-h-[46vh] overflow-hidden bg-nx-panel sm:min-h-[520px] lg:min-h-[52vh] xl:min-h-[58vh] 2xl:min-h-[62vh] 2xl:max-h-[760px]"
            style={imageStep === 3 && dominantColor ? { backgroundColor: dominantColor } : undefined}
        >
            {hasBackdrop && (
                <Image
                    src={backdropImage}
                    alt=""
                    fill
                    preload
                    sizes="(max-width: 390px) 100vw, (max-width: 1024px) 944px, (max-width: 1280px) 1188px, 1348px"
                    className="object-cover"
                    style={{ objectPosition: `${Math.round((focalX ?? 0.62) * 100)}% ${Math.round((focalY ?? 0.4) * 100)}%` }}
                    onError={failImage}
                />
            )}

            {!hasBackdrop && hasPoster && (
                <>
                    <Image
                        src={coverImage}
                        alt=""
                        fill
                        sizes="100vw"
                        className="scale-110 object-cover opacity-25 blur-2xl motion-reduce:blur-none"
                        onError={failImage}
                    />
                    <div className="absolute inset-y-0 right-0 hidden w-[44%] sm:block">
                        <Image
                            src={coverImage}
                            alt=""
                            fill
                            sizes="44vw"
                            className="object-contain object-right"
                            onError={failImage}
                        />
                    </div>
                </>
            )}

            {imageStep === 4 && (
                <div className="absolute right-6 top-6 font-mono text-[10px] tracking-[0.2em] text-nx-text-2">
                    BRAK MATERIAŁU GRAFICZNEGO
                </div>
            )}

            <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--nx-bg)_0%,color-mix(in_srgb,var(--nx-bg)_92%,transparent)_38%,transparent_76%)] lg:w-[82%]" />
            <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--nx-bg)_0%,color-mix(in_srgb,var(--nx-bg)_76%,transparent)_24%,transparent_66%)]" />

            <div className="relative z-10 mx-auto grid min-h-[46vh] w-full max-w-[1440px] grid-cols-4 items-end gap-x-4 px-5 pb-12 sm:min-h-[520px] sm:px-8 lg:min-h-[52vh] lg:grid-cols-12 lg:gap-x-5 lg:px-10 lg:pb-14 xl:min-h-[58vh] xl:px-11 2xl:min-h-[62vh] 2xl:max-h-[760px] 2xl:px-12">
                <div className="col-span-4 max-w-[46ch] lg:col-span-8 xl:col-span-7">
                    <p className="mb-3 font-mono text-[10px] tracking-[0.18em] text-nx-text-2 lg:text-[10.5px] xl:text-[11px]">
                        {resumeEpisodeKey ? "KONTYNUUJ OGLĄDANIE" : "OD POCZĄTKU"}
                    </p>
                    <h1
                        id="series-title"
                        className="font-display text-[34px] leading-none tracking-[-0.02em] text-nx-text sm:text-[42px] lg:text-[54px] lg:tracking-[-0.035em] xl:text-[66px] 2xl:text-[76px] 2xl:tracking-[-0.045em]"
                    >
                        {title}
                    </h1>

                    {metadata.length > 0 && (
                        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] tracking-[0.16em] text-nx-text-2 lg:text-[10.5px] xl:text-[11px]">
                            {metadata.map((item) => <span key={String(item)}>{item}</span>)}
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

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={play}
                            aria-disabled={!activeEpisodeKey}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-nx-accent px-6 text-[15px] font-semibold text-nx-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent sm:w-fit xl:h-13 ${activeEpisodeKey ? "" : "opacity-45"}`}
                        >
                            <Play size={18} fill="currentColor" />
                            {resumeEpisodeKey && resumeEpisodeNumber
                                ? `Wznów odcinek ${resumeEpisodeNumber}`
                                : "Odtwórz odcinek 1"}
                        </button>
                        <p className="mt-2 min-h-5 text-sm text-nx-text-2" aria-live="polite">{notice}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SeriesHero;
