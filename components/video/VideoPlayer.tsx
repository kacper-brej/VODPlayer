"use client";

import { useEffect, useRef, useState } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import {
    MediaErrorDetail,
    MediaPlayer,
    MediaPlayerInstance,
    MediaProvider,
    MediaTimeUpdateEventDetail,
    PlayButton,
    useMediaState,
} from '@vidstack/react';
import { AlertTriangle, SkipBack, SkipForward } from 'lucide-react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';

interface VideoPlayerProps {
    src: string;
    title: string;
    posterUrl?: string;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
    onProgressUpdate?: (currentTime: number) => void;
    startTime?: number;
}

interface EpisodeControlsProps {
    onPreviousEpisode?: () => void;
    onNextEpisode?: () => void;
}

const EpisodeControls = ({ onPreviousEpisode, onNextEpisode }: EpisodeControlsProps) => {
    const paused = useMediaState('paused');
    const ended = useMediaState('ended');
    const Icons = defaultLayoutIcons.PlayButton;
    const Icon = ended ? Icons.Replay : paused ? Icons.Play : Icons.Pause;

    return (
        <>
            {onPreviousEpisode && (
                <button onClick={onPreviousEpisode} className="vds-button" aria-label="Poprzedni odcinek">
                    <SkipBack size={18} className="fill-current" />
                </button>
            )}
            <PlayButton className="vds-button">
                <Icon />
            </PlayButton>
            {onNextEpisode && (
                <button onClick={onNextEpisode} className="vds-button" aria-label="Następny odcinek">
                    <SkipForward size={18} className="fill-current" />
                </button>
            )}
        </>
    );
};

const INTRO_SKIP_SECONDS = 90;
const NEXT_EPISODE_TRIGGER_SECONDS = 60;
const NEXT_EPISODE_AUTOPLAY_MS = 5000;

export const VideoPlayer = ({ src, title, posterUrl, onNextEpisode, onPreviousEpisode, onProgressUpdate, startTime = 0 }: VideoPlayerProps) => {
    const playerRef = useRef<MediaPlayerInstance>(null);
    const lastSavedTime = useRef<number>(0);
    const hasSeekedToStart = useRef(false);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [autoAdvanceCancelled, setAutoAdvanceCancelled] = useState(false);
    const [prevShowNextEpisode, setPrevShowNextEpisode] = useState(false);
    const [mediaError, setMediaError] = useState<MediaErrorDetail | null>(null);

    const handleError = (detail: MediaErrorDetail) => {
        setMediaError(detail);
    };

    const handleCanPlay = () => {
        setMediaError(null);

        if (!hasSeekedToStart.current && startTime > 0 && playerRef.current) {
            playerRef.current.currentTime = startTime;
            hasSeekedToStart.current = true;
        }
    };

    useEffect(() => {
        hasSeekedToStart.current = false;
    }, [src]);

    const handleTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
        const time = detail.currentTime;
        setCurrentTime(time);

        if (onProgressUpdate && Math.abs(time - lastSavedTime.current) >= 3) {
            onProgressUpdate(time);
            lastSavedTime.current = time;
        }
    };

    const handleDurationChange = (newDuration: number) => {
        setDuration(newDuration);
    };

    const handleSkipIntro = () => {
        if (playerRef.current) {
            playerRef.current.currentTime = INTRO_SKIP_SECONDS;
        }
    };

    const showSkipIntro = currentTime > 0 && currentTime < INTRO_SKIP_SECONDS;
    const showNextEpisode = !!onNextEpisode && duration > 0 && duration - currentTime <= NEXT_EPISODE_TRIGGER_SECONDS;

    if (showNextEpisode !== prevShowNextEpisode) {
        setPrevShowNextEpisode(showNextEpisode);
        setAutoAdvanceCancelled(false);
    }

    useEffect(() => {
        if (!showNextEpisode) return;

        const cancelAutoAdvance = () => setAutoAdvanceCancelled(true);

        window.addEventListener('mousemove', cancelAutoAdvance);
        window.addEventListener('touchstart', cancelAutoAdvance);
        window.addEventListener('click', cancelAutoAdvance);

        return () => {
            window.removeEventListener('mousemove', cancelAutoAdvance);
            window.removeEventListener('touchstart', cancelAutoAdvance);
            window.removeEventListener('click', cancelAutoAdvance);
        };
    }, [showNextEpisode]);

    useEffect(() => {
        if (!showNextEpisode || autoAdvanceCancelled) return;

        const timeout = setTimeout(() => {
            onNextEpisode?.();
        }, NEXT_EPISODE_AUTOPLAY_MS);

        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showNextEpisode, autoAdvanceCancelled]);

    return (
        <div className="w-full h-full relative bg-black">
            <MediaPlayer
                ref={playerRef}
                title={title}
                src={src}
                autoPlay
                keyTarget="document"
                className="w-full h-full"
                onEnded={onNextEpisode}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onError={handleError}
                playsInline
            >
                <MediaProvider />
                <DefaultVideoLayout
                    thumbnails={posterUrl}
                    icons={defaultLayoutIcons}
                    slots={{
                        playButton: <EpisodeControls onPreviousEpisode={onPreviousEpisode} onNextEpisode={onNextEpisode} />,
                    }}
                />
            </MediaPlayer>

            {mediaError && (
                <div className="absolute inset-0 z-[60] bg-black flex flex-col items-center justify-center gap-4 text-center px-6">
                    <AlertTriangle size={40} className="text-danger" />
                    <div className="flex flex-col gap-1.5">
                        <p className="text-foreground font-semibold">Nie udało się odtworzyć tego odcinka.</p>
                        <p className="text-muted text-sm">Plik wideo jest uszkodzony lub niedostępny na serwerze.</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        {onPreviousEpisode && (
                            <button
                                onClick={onPreviousEpisode}
                                className="px-4 py-2 bg-surface hover:bg-surface-light text-foreground text-sm font-semibold rounded-md border border-white/10 transition-colors cursor-pointer"
                            >
                                Poprzedni odcinek
                            </button>
                        )}
                        {onNextEpisode && (
                            <button
                                onClick={onNextEpisode}
                                className="px-4 py-2 bg-primary hover:bg-primary-hover text-foreground text-sm font-semibold rounded-md transition-colors cursor-pointer"
                            >
                                Następny odcinek
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showSkipIntro && !mediaError && (
                <button
                    onClick={handleSkipIntro}
                    className="absolute bottom-24 right-6 md:right-10 z-50 px-5 py-2.5 bg-surface/80 hover:bg-surface text-foreground font-semibold rounded-md border border-white/10 backdrop-blur-md transition-colors cursor-pointer"
                >
                    Pomiń czołówkę
                </button>
            )}

            {showNextEpisode && !mediaError && (
                <div
                    onClick={onNextEpisode}
                    className="absolute bottom-24 right-6 md:right-10 z-50 flex flex-col items-stretch bg-surface/80 hover:bg-surface backdrop-blur-md border border-white/10 rounded-md overflow-hidden cursor-pointer transition-colors"
                >
                    <span className="px-5 py-2.5 text-foreground font-semibold whitespace-nowrap">
                        Następny odcinek
                    </span>
                    {!autoAdvanceCancelled && (
                        <div className="h-1 w-full bg-black/40">
                            <div
                                className="h-full bg-primary"
                                style={{ animation: `next-episode-fill ${NEXT_EPISODE_AUTOPLAY_MS}ms linear forwards` }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
