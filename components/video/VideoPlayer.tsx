"use client";

import { useEffect, useRef, useState } from 'react';
import '@vidstack/react/player/styles/base.css';
import {
    Gesture,
    MediaErrorDetail,
    MediaPlayer,
    MediaPlayerInstance,
    MediaProvider,
    MediaTimeUpdateEventDetail,
    Poster,
} from '@vidstack/react';
import { AlertTriangle } from 'lucide-react';
import PlayerControls from './PlayerControls';
import {
    BufferingIndicator,
    NextEpisodePill,
    OverlaidPlayButton,
    SkipIntroPill,
    VolumeHud,
} from './PlayerOverlays';

interface VideoPlayerProps {
    src: string;
    title: string;
    subtitle?: string;
    posterUrl?: string;
    episodesLeft?: number;
    nextEpisodeTitle?: string;
    onBack?: () => void;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
    onProgressUpdate?: (currentTime: number, duration: number) => void;
    startTime?: number;
}

const INTRO_SKIP_SECONDS = 90;
const NEXT_EPISODE_TRIGGER_SECONDS = 60;
const NEXT_EPISODE_AUTOPLAY_MS = 5000;

const ERROR_BUTTON_CLASS =
    'px-6 py-3 bg-[#030712]/80 hover:bg-primary-hover border border-white/10 hover:border-primary-hover text-slate-200 hover:text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all duration-500 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:scale-105 cursor-pointer';

export const VideoPlayer = ({
    src,
    title,
    subtitle,
    posterUrl,
    episodesLeft,
    nextEpisodeTitle,
    onBack,
    onNextEpisode,
    onPreviousEpisode,
    onProgressUpdate,
    startTime = 0,
}: VideoPlayerProps) => {
    const playerRef = useRef<MediaPlayerInstance>(null);
    const lastSavedTime = useRef<number>(0);
    const hasSeekedToStart = useRef(false);
    const nextEpisodeRef = useRef(onNextEpisode);

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
            onProgressUpdate(time, duration);
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

    const hasNextEpisode = episodesLeft === undefined || episodesLeft > 0;
    const showSkipIntro = currentTime > 0 && currentTime < INTRO_SKIP_SECONDS;
    const showNextEpisode =
        !!onNextEpisode && hasNextEpisode && duration > 0 && duration - currentTime <= NEXT_EPISODE_TRIGGER_SECONDS;

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
        nextEpisodeRef.current = onNextEpisode;
    });

    useEffect(() => {
        if (!showNextEpisode || autoAdvanceCancelled) return;

        const timeout = setTimeout(() => {
            nextEpisodeRef.current?.();
        }, NEXT_EPISODE_AUTOPLAY_MS);

        return () => clearTimeout(timeout);
    }, [showNextEpisode, autoAdvanceCancelled]);

    return (
        <div className="np-stage">
            <MediaPlayer
                ref={playerRef}
                title={title}
                src={{ src, type: 'video/mp4' }}
                autoPlay
                keyTarget="document"
                className="np-player"
                fullscreenOrientation="landscape"
                onEnded={onNextEpisode}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onError={handleError}
                playsInline
            >
                <MediaProvider>
                    {posterUrl && <Poster className="np-poster" src={posterUrl} alt={title} />}
                </MediaProvider>

                <Gesture className="np-gesture np-gesture-fine" event="pointerup" action="toggle:paused" />
                <Gesture className="np-gesture np-gesture-coarse" event="pointerup" action="toggle:controls" />
                <Gesture className="np-gesture" event="dblpointerup" action="toggle:fullscreen" />

                <BufferingIndicator />
                <OverlaidPlayButton />
                <VolumeHud />

                <PlayerControls
                    heading={title}
                    subheading={subtitle}
                    onBack={onBack}
                    onNextEpisode={onNextEpisode}
                    onPreviousEpisode={onPreviousEpisode}
                />

                <SkipIntroPill visible={showSkipIntro && !mediaError} onSkip={handleSkipIntro} />

                {onNextEpisode && (
                    <NextEpisodePill
                        visible={showNextEpisode && !mediaError}
                        countdownMs={NEXT_EPISODE_AUTOPLAY_MS}
                        countdownActive={showNextEpisode && !autoAdvanceCancelled}
                        episodesLeft={episodesLeft}
                        nextEpisodeTitle={nextEpisodeTitle}
                        onNextEpisode={onNextEpisode}
                    />
                )}

                {mediaError && (
                    <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-5 px-6 text-center bg-[#030712]/95 backdrop-blur-xl">
                        <AlertTriangle size={40} className="text-primary-hover" />
                        <div className="flex flex-col gap-1.5">
                            <p className="text-white font-bold">Nie udało się odtworzyć tego odcinka.</p>
                            <p className="text-slate-400 text-sm">Plik wideo jest uszkodzony lub niedostępny na serwerze.</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {onBack && (
                                <button type="button" onClick={onBack} className={ERROR_BUTTON_CLASS}>
                                    Wróć
                                </button>
                            )}
                            {onPreviousEpisode && (
                                <button type="button" onClick={onPreviousEpisode} className={ERROR_BUTTON_CLASS}>
                                    Poprzedni odcinek
                                </button>
                            )}
                            {onNextEpisode && (
                                <button type="button" onClick={onNextEpisode} className={ERROR_BUTTON_CLASS}>
                                    Następny odcinek
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </MediaPlayer>
        </div>
    );
};
