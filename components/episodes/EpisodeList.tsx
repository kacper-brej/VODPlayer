"use client";

import Image from "next/image";
import { imageLoader } from "@/lib/imageDelivery";
import Link from "next/link";
import { Play, X } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import EpisodeCard, { type EpisodeCardData } from "@/components/episodes/EpisodeCard";
import SeasonsSelector, { type SeasonOption } from "@/components/series/SeasonsSelector";
import { watchPath } from "@/lib/routes";
import { useModalFocus } from "@/lib/useModalFocus";

export interface SeasonEpisodes extends SeasonOption {
    seriesId: number;
    episodes: EpisodeCardData[];
    resumeEpisodeKey: string | null;
}

interface EpisodeListProps {
    seasons: SeasonEpisodes[];
    initialSeason: string;
    authRequired: boolean;
}

const EpisodeList = ({ seasons, initialSeason, authRequired }: EpisodeListProps) => {
    const router = useRouter();
    const [activeSeason, setActiveSeason] = useState(initialSeason);
    const [activeCard, setActiveCard] = useState(0);
    const [blockedEpisode, setBlockedEpisode] = useState<EpisodeCardData | null>(null);
    const cards = useRef<Array<HTMLButtonElement | null>>([]);
    const closeBlockedEpisode = () => setBlockedEpisode(null);
    const loginDialogRef = useModalFocus<HTMLDivElement>(Boolean(blockedEpisode), closeBlockedEpisode);
    const season = seasons.find((entry) => entry.id === activeSeason) ?? seasons[0];

    const resumeEpisode = useMemo(() => {
        if (!season) return null;
        return season.episodes.find((episode) => episode.episodeKey === season.resumeEpisodeKey)
            ?? season.episodes[0]
            ?? null;
    }, [season]);

    const changeSeason = (id: string) => {
        setActiveSeason(id);
        setActiveCard(0);
        const url = new URL(window.location.href);
        url.searchParams.set("season", id);
        window.history.replaceState(window.history.state, "", url);
    };

    const play = (episode: EpisodeCardData) => {
        if (authRequired) {
            setBlockedEpisode(episode);
            return;
        }
        router.push(watchPath(episode.seriesId, episode.episodeKey));
    };

    const moveCard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const columns = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 1024 ? 2 : 1;
        const offsets: Record<string, number> = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -columns,
            ArrowDown: columns,
        };
        const offset = offsets[event.key];
        if (!offset) return;
        event.preventDefault();
        const next = Math.max(0, Math.min((season?.episodes.length ?? 1) - 1, index + offset));
        setActiveCard(next);
        cards.current[next]?.focus();
    };

    if (!season || season.episodes.length === 0) {
        return (
            <section aria-labelledby="episodes-heading" className="mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-10 xl:px-11 2xl:px-12">
                <h2 id="episodes-heading" className="font-display text-3xl text-nx-text">Odcinki</h2>
                <div className="mt-6 rounded-2xl border border-nx-border bg-nx-panel px-6 py-10">
                    <p className="text-nx-text">Ten tytuł nie ma jeszcze odcinków.</p>
                    <Link href="/upload" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-nx-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent">
                        Przejdź do wysyłania plików
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section aria-labelledby="episodes-heading" className="mx-auto w-full max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-10 xl:px-11 2xl:px-12">
            <h2 id="episodes-heading" className="font-display text-3xl text-nx-text lg:text-4xl">Odcinki</h2>
            <p className="sr-only" aria-live="polite">Wybrano {season.label}</p>

            <div className="mt-7 grid grid-cols-4 gap-x-4 gap-y-6 lg:grid-cols-12 lg:gap-x-5 xl:items-start">
                <div className="col-span-4 lg:col-span-12 xl:col-span-2">
                    <SeasonsSelector seasons={seasons} activeSeason={season.id} onSeasonChange={changeSeason} />
                </div>

                <div className="col-span-4 grid gap-5 lg:col-span-12 lg:grid-cols-12 xl:col-span-10 xl:grid-cols-10">
                    {resumeEpisode && (
                        <button
                            type="button"
                            onClick={() => play(resumeEpisode)}
                            className="group overflow-hidden rounded-2xl border border-nx-border bg-nx-panel text-left transition-colors hover:bg-nx-raised focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent lg:col-span-6 xl:col-span-4"
                        >
                            <span className="relative block aspect-video overflow-hidden bg-nx-panel">
                                {resumeEpisode.thumbnail ? (
                                    <Image
                                        src={resumeEpisode.thumbnail}
                                        alt={resumeEpisode.title}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 40vw"
                                        loader={imageLoader(resumeEpisode.thumbnail, "episode")}
                                        className={`object-cover ${resumeEpisode.watched ? "opacity-75" : ""}`}
                                    />
                                ) : (
                                    <span className="absolute inset-0 bg-nx-panel" />
                                )}
                                <span className="absolute inset-0 bg-[linear-gradient(0deg,var(--nx-bg),transparent_70%)]" />
                                <span className="absolute inset-0 flex items-center justify-center">
                                    <span className="flex size-12 items-center justify-center rounded-full bg-nx-accent text-nx-on-accent">
                                        <Play size={18} fill="currentColor" />
                                    </span>
                                </span>
                                {(resumeEpisode.watched || (resumeEpisode.started && resumeEpisode.progressKnown)) && (
                                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-nx-border">
                                        <span
                                            className={`block h-full ${resumeEpisode.watched ? "bg-nx-text-2" : "bg-nx-accent"}`}
                                            style={{ width: `${resumeEpisode.watched ? 100 : resumeEpisode.percent}%` }}
                                        />
                                    </span>
                                )}
                            </span>
                            <span className="block p-5">
                                <span className="font-mono text-[10px] tracking-[0.18em] text-nx-text-2">
                                    {season.resumeEpisodeKey ? "WZNÓW OGLĄDANIE" : "ZACZNIJ OD POCZĄTKU"}
                                </span>
                                <span className="mt-1 block text-lg font-semibold text-nx-text">{resumeEpisode.title}</span>
                                {resumeEpisode.remainingTime && (
                                    <span className="mt-2 block font-mono text-[10px] tracking-[0.12em] text-nx-text-2">
                                        {resumeEpisode.remainingTime}
                                    </span>
                                )}
                            </span>
                        </button>
                    )}

                    <div
                        role="grid"
                        aria-label={`Odcinki — ${season.label}`}
                        className="grid grid-cols-1 gap-4 lg:col-span-6 lg:grid-cols-2 xl:col-span-6 xl:grid-cols-3"
                    >
                        {season.episodes.map((episode, index) => (
                            <EpisodeCard
                                key={episode.id}
                                episode={episode}
                                tabIndex={index === activeCard ? 0 : -1}
                                cardRef={(element) => { cards.current[index] = element; }}
                                onFocus={() => setActiveCard(index)}
                                onPlay={play}
                                onKeyDown={(event) => moveCard(event, index)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {blockedEpisode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--nx-bg)_88%,transparent)] p-5">
                    <div
                        ref={loginDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="login-title"
                        tabIndex={-1}
                        className="relative w-full max-w-md rounded-[28px] border border-nx-border bg-nx-panel p-7 outline-none"
                    >
                        <button
                            type="button"
                            onClick={closeBlockedEpisode}
                            aria-label="Anuluj"
                            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full border border-nx-border text-nx-text focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                        >
                            <X size={18} />
                        </button>
                        <h3 id="login-title" className="pr-12 font-display text-3xl text-nx-text">Zaloguj się, aby oglądać</h3>
                        <p className="mt-3 text-sm leading-relaxed text-nx-text-2">
                            Po zalogowaniu wrócisz do wybranego odcinka.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <Link
                                href={`/login?returnTo=${encodeURIComponent(watchPath(blockedEpisode.seriesId, blockedEpisode.episodeKey))}`}
                                className="flex min-h-12 items-center rounded-xl bg-nx-accent px-5 text-sm font-semibold text-nx-on-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent"
                            >
                                Zaloguj się
                            </Link>
                            <button type="button" onClick={closeBlockedEpisode} className="min-h-12 rounded-xl border border-nx-border px-5 text-sm font-semibold text-nx-text focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-nx-accent">
                                Anuluj
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default EpisodeList;
