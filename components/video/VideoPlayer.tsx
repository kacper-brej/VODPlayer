"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import '@vidstack/react/player/styles/base.css';
import {
    Gesture,
    isHLSProvider,
    MediaErrorDetail,
    MediaPlayer,
    MediaPlayerInstance,
    MediaProvider,
    MediaProviderAdapter,
    MediaTimeUpdateEventDetail,
    Poster,
} from '@vidstack/react';
import type { ErrorData as HlsErrorData } from 'hls.js';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import type { EpisodeChapter } from '@/lib/contracts';
import type { PlaybackSource } from '@/lib/videoAccess';
import { buildHlsConfig } from '@/lib/videoPlayerConfig';
import refreshPlaybackSourceAction from '@/lib/refreshPlaybackSourceAction';
import PlayerControls from './PlayerControls';
import {
    BufferingIndicator,
    NextEpisodePill,
    OverlaidPlayButton,
    SeekFeedback,
    SkipIntroPill,
    VolumeHud,
} from './PlayerOverlays';

interface VideoPlayerProps {
    playback: PlaybackSource;
    seriesKey: string;
    episodeKey: string;
    title: string;
    kicker?: string;
    subtitle?: string;
    seasonNumber?: number | null;
    episodeNumber?: number;
    episodeSynopsis?: string | null;
    posterUrl?: string;
    episodesLeft?: number;
    nextEpisodeTitle?: string;
    onBack?: () => void;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
    onProgressUpdate?: (currentTime: number, duration: number) => void | Promise<void>;
    startTime?: number;
    chapters?: EpisodeChapter[];
    autoplayNext?: boolean;
    skipIntroPrompt?: boolean;
    defaultVolume?: number;
}

const NEXT_EPISODE_TRIGGER_SECONDS = 60;
const NEXT_EPISODE_AUTOPLAY_MS = 5000;
const PROGRESS_SAVE_INTERVAL_SECONDS = 12;

const isEditableTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return element?.isContentEditable
        || element?.tagName === 'INPUT'
        || element?.tagName === 'TEXTAREA'
        || element?.tagName === 'SELECT'
        || element?.tagName === 'BUTTON';
};

export const VideoPlayer = ({
    playback,
    seriesKey,
    episodeKey,
    title,
    kicker,
    subtitle,
    seasonNumber,
    episodeNumber,
    episodeSynopsis,
    posterUrl,
    episodesLeft,
    nextEpisodeTitle,
    onBack,
    onNextEpisode,
    onPreviousEpisode,
    onProgressUpdate,
    startTime = 0,
    chapters = [],
    autoplayNext = true,
    skipIntroPrompt = true,
    defaultVolume,
}: VideoPlayerProps) => {
    const playerRef = useRef<MediaPlayerInstance>(null);
    const prefersReducedMotion = useReducedMotion();
    const lastQueuedTimeRef = useRef(0);
    const lastUiSecondRef = useRef(-1);
    const currentTimeRef = useRef(0);
    const durationRef = useRef(0);
    const hasSeekedToStart = useRef(false);
    const hasAppliedDefaultVolume = useRef(false);
    const nextEpisodeRef = useRef(onNextEpisode);
    const seekFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveInFlightRef = useRef(false);
    const pendingProgressRef = useRef<{
        time: number;
        duration: number;
        update: NonNullable<VideoPlayerProps["onProgressUpdate"]>;
    } | null>(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [autoAdvanceCancelled, setAutoAdvanceCancelled] = useState(false);
    const [prevShowNextEpisode, setPrevShowNextEpisode] = useState(false);
    const [mediaError, setMediaError] = useState<MediaErrorDetail | null>(null);
    const [mediaInstanceKey, setMediaInstanceKey] = useState(0);
    const [seekFeedback, setSeekFeedback] = useState<{
        direction: 'backward' | 'forward';
        seconds: number;
        id: number;
    } | null>(null);
    const [activePlayback, setActivePlayback] = useState<PlaybackSource>(playback);
    const [previousPlaybackSrc, setPreviousPlaybackSrc] = useState(playback.src);
    const [manifestUnrecoverable, setManifestUnrecoverable] = useState(false);
    const refreshAttemptsRef = useRef(0);
    const desiredStartPositionRef = useRef(startTime);

    const showSeekFeedback = useCallback((seconds: number) => {
        if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);

        setSeekFeedback({
            direction: seconds < 0 ? 'backward' : 'forward',
            seconds: Math.abs(seconds),
            id: Date.now(),
        });

        seekFeedbackTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 700);
    }, []);

    useEffect(() => () => {
        if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);
    }, []);

    const drainProgressQueue = useCallback(async () => {
        if (saveInFlightRef.current) return;
        saveInFlightRef.current = true;

        try {
            while (pendingProgressRef.current) {
                const pending = pendingProgressRef.current;
                pendingProgressRef.current = null;
                await pending.update(pending.time, pending.duration);
            }
        } finally {
            saveInFlightRef.current = false;
        }
    }, []);

    const flushProgress = useCallback(() => {
        const time = currentTimeRef.current;
        const mediaDuration = durationRef.current;

        if (!onProgressUpdate || !Number.isFinite(time) || time < 0) return;
        if (Math.abs(time - lastQueuedTimeRef.current) < 0.5) return;

        pendingProgressRef.current = {
            time,
            duration: mediaDuration,
            update: onProgressUpdate,
        };
        lastQueuedTimeRef.current = time;
        void drainProgressQueue();
    }, [drainProgressQueue, onProgressUpdate]);

    const attemptPlaybackRefresh = useCallback(() => {
        if (refreshAttemptsRef.current >= 1) {
            setManifestUnrecoverable(true);
            return;
        }

        refreshAttemptsRef.current += 1;
        desiredStartPositionRef.current = currentTimeRef.current;

        void refreshPlaybackSourceAction(seriesKey, episodeKey).then((result) => {
            if (result.kind !== 'success') {
                setManifestUnrecoverable(true);
                return;
            }

            hasSeekedToStart.current = false;
            setActivePlayback(result.data);
        });
    }, [seriesKey, episodeKey]);

    const handleProviderChange = useCallback((provider: MediaProviderAdapter | null) => {
        if (isHLSProvider(provider)) {
            provider.library = () => import('hls.js');
            provider.config = buildHlsConfig(desiredStartPositionRef.current);

            if (playerRef.current) {
                playerRef.current.qualities.switch = 'next';
            }
        }
    }, []);

    const handleHlsError = useCallback((detail: HlsErrorData) => {
        if (!detail.fatal) return;

        const statusCode = detail.response?.code;

        if (statusCode === 403) {
            setManifestUnrecoverable(true);
            return;
        }

        if (statusCode === 410) {
            attemptPlaybackRefresh();
        }
    }, [attemptPlaybackRefresh]);

    const handleError = (detail: MediaErrorDetail) => {
        if (activePlayback.kind === 'mp4' && refreshAttemptsRef.current < 1) {
            attemptPlaybackRefresh();
            return;
        }

        setMediaError(detail);
    };

    const handleCanPlay = () => {
        setMediaError(null);

        if (
            activePlayback.kind === 'mp4'
            && !hasSeekedToStart.current
            && desiredStartPositionRef.current > 0
            && playerRef.current
        ) {
            playerRef.current.currentTime = desiredStartPositionRef.current;
            hasSeekedToStart.current = true;
        }

        if (!hasAppliedDefaultVolume.current && defaultVolume !== undefined && playerRef.current) {
            playerRef.current.volume = Math.min(1, Math.max(0, defaultVolume / 100));
            hasAppliedDefaultVolume.current = true;
        }
    };

    useEffect(() => {
        hasSeekedToStart.current = false;
        hasAppliedDefaultVolume.current = false;
        currentTimeRef.current = 0;
        durationRef.current = 0;
        lastQueuedTimeRef.current = 0;
        lastUiSecondRef.current = -1;
        refreshAttemptsRef.current = 0;
        desiredStartPositionRef.current = startTime;
    }, [playback.src, startTime]);

    if (playback.src !== previousPlaybackSrc) {
        setPreviousPlaybackSrc(playback.src);
        setManifestUnrecoverable(false);
        setActivePlayback(playback);
    }

    const handleTimeUpdate = (detail: MediaTimeUpdateEventDetail) => {
        const time = detail.currentTime;
        currentTimeRef.current = time;

        const uiSecond = Math.floor(time);
        if (uiSecond !== lastUiSecondRef.current) {
            lastUiSecondRef.current = uiSecond;
            setCurrentTime(time);
        }

        if (onProgressUpdate && Math.abs(time - lastQueuedTimeRef.current) >= PROGRESS_SAVE_INTERVAL_SECONDS) {
            flushProgress();
        }
    };

    const handleDurationChange = (newDuration: number) => {
        setDuration(newDuration);
        durationRef.current = newDuration;
    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flushProgress();
        };
        const handlePageHide = () => flushProgress();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [flushProgress]);

    const hasNextEpisode = episodesLeft === undefined || episodesLeft > 0;
    const introChapter = chapters.find((chapter) => chapter.type === 'intro') ?? null;
    const introEndSeconds = introChapter
        ? duration > 0
            ? Math.min(introChapter.endSeconds, duration)
            : introChapter.endSeconds
        : null;
    const showSkipIntro = Boolean(
        skipIntroPrompt
        && introChapter
        && introEndSeconds
        && duration > 0
        && currentTime >= introChapter.startSeconds
        && currentTime < introEndSeconds
    );
    const showNextEpisode =
        !!onNextEpisode && hasNextEpisode && duration > 0 && duration - currentTime <= NEXT_EPISODE_TRIGGER_SECONDS;

    const handleSkipIntro = useCallback(() => {
        if (playerRef.current && introEndSeconds !== null) {
            playerRef.current.currentTime = introEndSeconds;
        }
    }, [introEndSeconds]);

    useEffect(() => {
        if (!showSkipIntro || mediaError) return;

        const handleShortcut = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;

            if (
                event.key.toLowerCase() !== 's'
                || target?.isContentEditable
                || target?.tagName === 'INPUT'
                || target?.tagName === 'TEXTAREA'
                || target?.tagName === 'SELECT'
            ) {
                return;
            }

            event.preventDefault();
            handleSkipIntro();
        };

        document.addEventListener('keydown', handleShortcut);
        return () => document.removeEventListener('keydown', handleShortcut);
    }, [handleSkipIntro, mediaError, showSkipIntro]);

    useEffect(() => {
        const handleKeyboard = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) return;

            const player = playerRef.current;
            if (!player) return;

            const key = event.key.toLowerCase();
            const seek = (seconds: number) => {
                player.currentTime = Math.min(
                    durationRef.current || Number.POSITIVE_INFINITY,
                    Math.max(0, player.currentTime + seconds),
                );
                showSeekFeedback(seconds);
            };

            if (key === 's' && showSkipIntro) return;

            if (key === ' ' || key === 'k') {
                event.preventDefault();
                if (player.paused) void player.play().catch(() => undefined);
                else void player.pause().catch(() => undefined);
            } else if (key === 'arrowleft') {
                event.preventDefault();
                seek(-5);
            } else if (key === 'arrowright') {
                event.preventDefault();
                seek(5);
            } else if (key === 'j') {
                event.preventDefault();
                seek(-10);
            } else if (key === 'l') {
                event.preventDefault();
                seek(10);
            } else if (key === 'arrowup') {
                event.preventDefault();
                player.volume = Math.min(1, player.volume + 0.05);
            } else if (key === 'arrowdown') {
                event.preventDefault();
                player.volume = Math.max(0, player.volume - 0.05);
            } else if (key === 'm') {
                event.preventDefault();
                player.muted = !player.muted;
            } else if (key === 'f') {
                event.preventDefault();
                if (document.fullscreenElement) void player.exitFullscreen().catch(() => undefined);
                else void player.enterFullscreen().catch(() => undefined);
            } else if (key === 'c') {
                event.preventDefault();
                player.remoteControl.toggleCaptions(event);
            } else if (key === 'n' && onNextEpisode) {
                event.preventDefault();
                onNextEpisode();
            } else if (key === 'p' && onPreviousEpisode) {
                event.preventDefault();
                onPreviousEpisode();
            } else if (/^[0-9]$/.test(key) && durationRef.current > 0) {
                event.preventDefault();
                player.currentTime = durationRef.current * Number(key) / 10;
            } else if (key === 'escape' && !document.fullscreenElement && onBack) {
                event.preventDefault();
                onBack();
            }
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [onBack, onNextEpisode, onPreviousEpisode, showSeekFeedback, showSkipIntro]);

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
    }, [onNextEpisode]);

    useEffect(() => {
        if (!showNextEpisode || autoAdvanceCancelled || prefersReducedMotion || !autoplayNext) return;

        const timeout = setTimeout(() => {
            nextEpisodeRef.current?.();
        }, NEXT_EPISODE_AUTOPLAY_MS);

        return () => clearTimeout(timeout);
    }, [showNextEpisode, autoAdvanceCancelled, prefersReducedMotion, autoplayNext]);

    const handleEnded = () => {
        flushProgress();
        if (!prefersReducedMotion && autoplayNext) onNextEpisode?.();
    };

    const handleRetry = () => {
        setMediaError(null);
        setManifestUnrecoverable(false);
        refreshAttemptsRef.current = 0;
        setMediaInstanceKey((value) => value + 1);
    };

    const mediaSrc = activePlayback.kind === 'hls'
        ? { src: activePlayback.src, type: 'application/vnd.apple.mpegurl' as const }
        : { src: activePlayback.src, type: 'video/mp4' as const };

    return (
        <MotionConfig reducedMotion="user">
        <div className="np-stage">
            <MediaPlayer
                key={`${activePlayback.src}-${mediaInstanceKey}`}
                ref={playerRef}
                title={subtitle ? `${title} — ${subtitle}` : title}
                src={mediaSrc}
                onProviderChange={handleProviderChange}
                onHlsError={handleHlsError}
                autoPlay
                keyTarget="document"
                keyDisabled
                className="np-player"
                fullscreenOrientation="landscape"
                onEnded={handleEnded}
                onCanPlay={handleCanPlay}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onError={handleError}
                onPause={flushProgress}
                playsInline
            >
                <MediaProvider>
                    {posterUrl && <Poster className="np-poster" src={posterUrl} alt={title} />}
                </MediaProvider>

                <Gesture className="np-gesture np-gesture-fine" event="pointerup" action="toggle:paused" />
                <Gesture className="np-gesture np-gesture-fine" event="dblpointerup" action="toggle:fullscreen" />
                <Gesture className="np-gesture np-gesture-coarse np-gesture-center" event="pointerup" action="toggle:paused" />
                <Gesture
                    className="np-gesture np-gesture-coarse np-gesture-left"
                    event="dblpointerup"
                    action="seek:-10"
                    onTrigger={() => showSeekFeedback(-10)}
                />
                <Gesture
                    className="np-gesture np-gesture-coarse np-gesture-right"
                    event="dblpointerup"
                    action="seek:10"
                    onTrigger={() => showSeekFeedback(10)}
                />

                <BufferingIndicator />
                <OverlaidPlayButton
                    seriesTitle={title}
                    seasonNumber={seasonNumber}
                    episodeNumber={episodeNumber}
                    episodeTitle={subtitle}
                    synopsis={episodeSynopsis}
                />
                <SeekFeedback feedback={seekFeedback} />
                <VolumeHud />

                <PlayerControls
                    heading={title}
                    kicker={kicker}
                    subheading={subtitle}
                    episodeNumber={episodeNumber}
                    onBack={onBack}
                    onNextEpisode={onNextEpisode}
                    onPreviousEpisode={onPreviousEpisode}
                    onSeekFeedback={showSeekFeedback}
                    chapters={chapters}
                />

                <SkipIntroPill
                    visible={showSkipIntro && !showNextEpisode && !mediaError && !manifestUnrecoverable}
                    onSkip={handleSkipIntro}
                />

                {onNextEpisode && (
                    <NextEpisodePill
                        visible={showNextEpisode && !mediaError && !manifestUnrecoverable}
                        countdownMs={NEXT_EPISODE_AUTOPLAY_MS}
                        countdownActive={showNextEpisode && !autoAdvanceCancelled && !prefersReducedMotion && autoplayNext}
                        episodesLeft={episodesLeft}
                        nextEpisodeTitle={nextEpisodeTitle}
                        onNextEpisode={onNextEpisode}
                    />
                )}

                {(mediaError || manifestUnrecoverable) && (
                    <div className="np-error-layer" role="alert">
                        <div className="np-error-panel">
                            <AlertTriangle className="np-error-icon" />
                            <div className="np-error-copy">
                                <h2>Nie udało się odtworzyć odcinka</h2>
                                <p>
                                    {manifestUnrecoverable
                                        ? 'Sesja odtwarzania wygasła i nie udało się jej odświeżyć.'
                                        : 'Plik jest chwilowo niedostępny albo przeglądarka nie może go odczytać.'}
                                </p>
                            </div>
                            <div className="np-error-actions">
                                <button type="button" onClick={handleRetry} className="np-error-primary">
                                    <RotateCcw />
                                    Spróbuj ponownie
                                </button>
                                {onBack && (
                                    <button type="button" onClick={onBack} className="np-error-secondary">
                                        Wróć do serialu
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </MediaPlayer>
        </div>
        </MotionConfig>
    );
};
