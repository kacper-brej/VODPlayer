"use client";

import Image from "next/image";
import { Check, Play } from "lucide-react";
import { useState, type KeyboardEvent, type Ref } from "react";
import { formatEpisodeNumber } from "@/lib/catalog/seriesPage";
import { ARTWORK_SIZES, imageLoader } from "@/lib/catalog/imageDelivery";
import type { PreviewSource } from "@/lib/player/videoAccess";
import { usePreviewSurface } from "@/components/preview/usePreviewSurface";

export interface EpisodeCardData {
    id: string;
    seriesId: number;
    episodeKey: string;
    episodeNumber: number;
    title: string;
    fileName: string;
    thumbnail: string | null;
    percent: number;
    remainingTime: string | null;
    watched: boolean;
    started: boolean;
    progressKnown: boolean;
    isNew: boolean;
    previewSource: PreviewSource | null;
}

interface EpisodeCardProps {
    episode: EpisodeCardData;
    tabIndex: number;
    cardRef: Ref<HTMLButtonElement>;
    onFocus: () => void;
    onPlay: (episode: EpisodeCardData) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const EpisodeCard = ({
    episode,
    tabIndex,
    cardRef,
    onFocus,
    onPlay,
    onKeyDown,
}: EpisodeCardProps) => {
    const [imageFailed, setImageFailed] = useState(false);
    const preview = usePreviewSurface(episode.previewSource);
    const caption = episode.remainingTime
        ?? (/\.[a-z0-9]{2,4}$/i.test(episode.fileName) ? episode.fileName : null);

    return (
        <article
            role="gridcell"
            aria-label={`${episode.title}${episode.watched ? ", obejrzane" : episode.started ? episode.progressKnown ? `, obejrzane w ${episode.percent}%` : ", rozpoczęte" : ""}`}
            className="group relative w-full scroll-m-6 overflow-hidden rounded-2xl border border-nx-border bg-nx-panel text-left transition-colors hover:bg-nx-raised"
        >
            <button
                ref={cardRef}
                type="button"
                tabIndex={tabIndex}
                onClick={() => onPlay(episode)}
                onKeyDown={onKeyDown}
                {...preview.surfaceProps}
                onFocus={(event) => {
                    preview.surfaceProps.onFocus(event);
                    onFocus();
                }}
                aria-label={`Odtwórz ${episode.title}`}
                className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-nx-accent"
            >
            <span className="relative block aspect-video overflow-hidden bg-nx-panel">
                {episode.thumbnail && !imageFailed ? (
                    <Image
                        src={episode.thumbnail}
                        alt={episode.title}
                        fill
                        sizes={ARTWORK_SIZES.episode}
                        loader={imageLoader(episode.thumbnail, "episode")}
                        className={`object-cover transition-opacity motion-reduce:transition-none ${episode.watched ? "opacity-75" : ""}`}
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-xl text-nx-text-2">
                        {formatEpisodeNumber(episode.episodeNumber)}
                    </span>
                )}

                {episode.previewSource && (
                    <video
                        {...preview.videoProps}
                        className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${preview.isPlaying ? "opacity-100" : "opacity-0"}`}
                    />
                )}

                <span className="absolute inset-0 border border-[color-mix(in_srgb,var(--nx-text)_9%,transparent)]" />
                <span className="absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--nx-bg)_32%,transparent)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="flex size-11 items-center justify-center rounded-full border border-nx-text bg-[color-mix(in_srgb,var(--nx-bg)_65%,transparent)] text-nx-text">
                        <Play size={17} fill="currentColor" />
                    </span>
                </span>

                {episode.watched && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md border border-nx-border bg-nx-panel px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-nx-text-2">
                        <Check size={11} />
                        OBEJRZANE
                    </span>
                )}

                {episode.isNew && (
                    <span className="absolute right-2 top-2 rounded-md bg-nx-accent-2 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-nx-on-accent">
                        NOWY
                    </span>
                )}

                {(episode.watched || (episode.started && episode.progressKnown)) && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-nx-border">
                        <span
                            className={`block h-full ${episode.watched ? "bg-nx-text-2" : "bg-nx-accent"}`}
                            style={{ width: `${episode.watched ? 100 : episode.percent}%` }}
                        />
                    </span>
                )}
            </span>

            <span className="block p-4">
                <span className="block font-mono text-[10px] tracking-[0.16em] text-nx-text-2">
                    ODCINEK {formatEpisodeNumber(episode.episodeNumber)}
                </span>
                <span className="mt-1 line-clamp-2 block text-[15px] font-semibold leading-[1.35] text-nx-text">
                    {episode.title}
                </span>
                {caption && (
                    <span className="mt-2 line-clamp-1 block font-mono text-[10px] tracking-[0.08em] text-nx-text-2">
                        {caption}
                    </span>
                )}
            </span>
            </button>

            {episode.previewSource && (
                <button
                    type="button"
                    onClick={preview.startManual}
                    aria-label={`Odtwórz podgląd: ${episode.title}`}
                    className="absolute bottom-3 right-3 z-20 flex size-10 items-center justify-center rounded-full border border-nx-border bg-nx-panel text-nx-text opacity-0 outline-none transition-opacity hover:bg-nx-raised focus:opacity-100 focus-visible:outline-2 focus-visible:outline-nx-accent group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                >
                    <Play size={15} fill="currentColor" aria-hidden="true" />
                </button>
            )}
        </article>
    );
};

export default EpisodeCard;
