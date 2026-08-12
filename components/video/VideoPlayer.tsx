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
import type {
    EpisodeChapter,
    WatchPartyAnchor,
    WatchPartyBufferingWait,
    WatchPartyCommand,
    WatchPartyMember,
    WatchPartyMessage,
    WatchPartyRole,
    WatchPartyLastAction,
    WatchPartyControlMode,
} from '@/lib/core/contracts';
import type { DriftCorrectionDecision } from '@/lib/party/driftCorrection';
import type { PartySyncQuality } from '@/lib/party/usePartySync';
import {
    applyPartyAnchor,
    applyPartyCorrection,
    resumePartyPlaybackAfterGesture,
    type PartyPlaybackAdapter,
} from '@/lib/party/partyPlayerAdapter';
import { requestPlaybackToggle } from '@/lib/player/controlledPlayback';
import type { PlaybackSource } from '@/lib/player/videoAccess';
import { buildHlsConfig } from '@/lib/player/videoPlayerConfig';
import {
    HLS_REFRESH_BACKOFF_MS,
    HLS_REFRESH_MAX_ATTEMPTS,
    playbackRefreshSnapshot,
    shouldRefreshHlsAccess,
} from '@/lib/player/playbackRefresh';
import refreshPlaybackSourceAction from '@/lib/upload/refreshPlaybackSourceAction';
import PlayerControls from './PlayerControls';
import {
    BufferingIndicator,
    NextEpisodePill,
    OverlaidPlayButton,
    PartyParticipants,
    PartyBufferingNotice,
    SeekFeedback,
    SkipIntroPill,
    VolumeHud,
    PartyPlaybackGate,
} from './PlayerOverlays';
import { PartyChatPanel } from './PartyChatPanel';

export interface VideoPlayerSync {
    anchor: WatchPartyAnchor;
    clockOffsetMs: number;
    role: WatchPartyRole;
    canControl: boolean;
    waitingForGesture: boolean;
    nextEpisodeKey?: string;
    previousEpisodeKey?: string;
    sendIntent: (command: WatchPartyCommand) => Promise<unknown>;
    expectedPosition: (clientNowMs?: number) => number | null;
    registerPlaybackAdapter: (adapter: PartyPlaybackAdapter | null) => void;
    onWaitingForGestureChange: (waiting: boolean) => void;
    participants: WatchPartyMember[];
    viewerProfileId: number;
    chatMessages: WatchPartyMessage[];
    unreadChatCount: number;
    onChatOpenChange: (open: boolean) => void;
    sendChatMessage: (body: string) => Promise<boolean>;
    bufferingWait: WatchPartyBufferingWait | null;
    reportBuffering: (buffering: boolean) => Promise<boolean>;
    transferHost: (targetProfileId: number) => Promise<boolean>;
    controlMode: WatchPartyControlMode;
    lastAction: WatchPartyLastAction | null;
    syncQuality: PartySyncQuality;
    changeControlMode: (controlMode: WatchPartyControlMode) => Promise<boolean>;
}

export interface VideoPlayerProps {
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
    sync?: VideoPlayerSync;
}

const NEXT_EPISODE_TRIGGER_SECONDS = 60;
const NEXT_EPISODE_AUTOPLAY_MS = 5000;
const PROGRESS_SAVE_INTERVAL_SECONDS = 12;
const PARTY_BUFFERING_DEBOUNCE_MS = 800;

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
    sync,
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
    const [cancelledAutoAdvanceEpisode, setCancelledAutoAdvanceEpisode] = useState<string | null>(null);
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
    const [partyNotice, setPartyNotice] = useState<string | null>(null);
    const refreshAttemptsRef = useRef(0);
    const refreshInFlightRef = useRef(false);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const bufferingReportedRef = useRef(false);
    const shouldResumeAfterRefreshRef = useRef(true);
    const selectedQualityHeightRef = useRef<number | null>(null);
    const desiredStartPositionRef = useRef(startTime);
    const canPlayRef = useRef(false);
    const seekingRef = useRef(false);
    const syncRef = useRef(sync);
    const registerPlaybackAdapter = sync?.registerPlaybackAdapter;
    const anchorVersion = sync?.anchor.anchorVersion;

    useEffect(() => {
        syncRef.current = sync;
    }, [sync]);

    const showPartyControlDenied = useCallback(() => {
        setPartyNotice('Tylko prowadzący może sterować odtwarzaniem.');
        window.setTimeout(() => setPartyNotice(null), 2400);
    }, []);

    const sendPartyIntent = useCallback((command: WatchPartyCommand) => {
        const currentSync = syncRef.current;
        if (!currentSync) return;
        if (!currentSync.canControl) {
            showPartyControlDenied();
            return;
        }
        void currentSync.sendIntent(command);
    }, [showPartyControlDenied]);

    const applyCurrentPartyAnchor = useCallback(async () => {
        const currentSync = syncRef.current;
        if (!currentSync || !canPlayRef.current) return;
        const result = await applyPartyAnchor(playerRef.current, currentSync.anchor.state, currentSync.expectedPosition);
        currentSync.onWaitingForGestureChange(result === 'gesture-required');
    }, []);

    useEffect(() => {
        if (!registerPlaybackAdapter) return;
        const adapter: PartyPlaybackAdapter = {
            read: () => {
                const player = playerRef.current;
                if (!player || !canPlayRef.current || seekingRef.current) return null;
                return {
                    positionSeconds: player.currentTime,
                    playbackRate: player.playbackRate,
                    state: player.paused ? 'paused' : 'playing',
                };
            },
            correct: (decision: DriftCorrectionDecision) =>
                applyPartyCorrection(playerRef.current, decision, canPlayRef.current, seekingRef.current),
        };
        registerPlaybackAdapter(adapter);
        return () => registerPlaybackAdapter(null);
    }, [registerPlaybackAdapter]);

    useEffect(() => {
        if (anchorVersion === undefined) return;
        void applyCurrentPartyAnchor();
    }, [anchorVersion, applyCurrentPartyAnchor]);

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

    const handleBackWithFlush = useCallback(() => {
        flushProgress();
        onBack?.();
    }, [flushProgress, onBack]);

    const attemptPlaybackRefresh = useCallback(() => {
        if (refreshInFlightRef.current) return;
        if (refreshAttemptsRef.current >= HLS_REFRESH_MAX_ATTEMPTS) {
            setManifestUnrecoverable(true);
            return;
        }

        const snapshot = playbackRefreshSnapshot(
            currentTimeRef.current,
            playerRef.current?.paused ?? false,
            playerRef.current?.qualities.selected?.height ?? null,
        );
        const partyPosition = syncRef.current?.expectedPosition() ?? null;
        desiredStartPositionRef.current = partyPosition ?? snapshot.positionSeconds;
        shouldResumeAfterRefreshRef.current = syncRef.current ? true : !snapshot.paused;
        selectedQualityHeightRef.current = snapshot.qualityHeight;
        refreshInFlightRef.current = true;

        const refresh = async () => {
            while (refreshAttemptsRef.current < HLS_REFRESH_MAX_ATTEMPTS) {
                const attempt = refreshAttemptsRef.current++;
                await new Promise<void>((resolve) => {
                    refreshTimerRef.current = setTimeout(
                        resolve,
                        HLS_REFRESH_BACKOFF_MS[attempt] ?? HLS_REFRESH_BACKOFF_MS.at(-1),
                    );
                });
                if (!refreshInFlightRef.current) return;

                try {
                    const result = await refreshPlaybackSourceAction(seriesKey, episodeKey);
                    if (result.kind !== 'success') continue;

                    hasSeekedToStart.current = false;
                    setManifestUnrecoverable(false);
                    setActivePlayback(result.data);
                    return;
                } catch {
                }
            }

            refreshInFlightRef.current = false;
            setManifestUnrecoverable(true);
        };

        void refresh();
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
        const statusCode = detail.response?.code;

        if (shouldRefreshHlsAccess(detail.fatal, statusCode, refreshAttemptsRef.current)) {
            attemptPlaybackRefresh();
        } else if (detail.fatal && (statusCode === 403 || statusCode === 410)) {
            setManifestUnrecoverable(true);
        }
    }, [attemptPlaybackRefresh]);

    const handleError = (detail: MediaErrorDetail) => {
        setMediaError(detail);
    };

    const clearBufferingReport = useCallback(() => {
        if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
        if (!bufferingReportedRef.current) return;
        bufferingReportedRef.current = false;
        void syncRef.current?.reportBuffering(false);
    }, []);

    const reportWaiting = useCallback(() => {
        if (!syncRef.current || refreshInFlightRef.current || bufferingTimerRef.current || bufferingReportedRef.current) return;
        bufferingTimerRef.current = setTimeout(() => {
            bufferingTimerRef.current = null;
            if (!syncRef.current || refreshInFlightRef.current) return;
            bufferingReportedRef.current = true;
            void syncRef.current.reportBuffering(true);
        }, PARTY_BUFFERING_DEBOUNCE_MS);
    }, []);

    const handleCanPlay = () => {
        clearBufferingReport();
        canPlayRef.current = true;
        setMediaError(null);
        refreshInFlightRef.current = false;
        refreshAttemptsRef.current = 0;

        const selectedHeight = selectedQualityHeightRef.current;
        if (selectedHeight !== null && playerRef.current) {
            const selectedQuality = Array.from(playerRef.current.qualities)
                .find((quality) => quality?.height === selectedHeight);
            if (selectedQuality) selectedQuality.selected = true;
            selectedQualityHeightRef.current = null;
        }
        if (syncRef.current) void applyCurrentPartyAnchor();
        else if (!shouldResumeAfterRefreshRef.current) playerRef.current?.pause();

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
        canPlayRef.current = false;
    }, [playback.src, startTime]);

    useEffect(() => () => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
        if (bufferingReportedRef.current) void syncRef.current?.reportBuffering(false);
        refreshInFlightRef.current = false;
    }, []);

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
            if (document.visibilityState === 'hidden') {
                flushProgress();
                return;
            }
            const expectedPosition = syncRef.current?.expectedPosition();
            if (expectedPosition !== null && expectedPosition !== undefined) {
                applyPartyCorrection(
                    playerRef.current,
                    { kind: 'seek', positionSeconds: expectedPosition },
                    canPlayRef.current,
                    seekingRef.current,
                );
            }
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
    const autoAdvanceCancelled = cancelledAutoAdvanceEpisode === episodeKey;
    const nextEpisodeCountdownActive = Boolean(
        showNextEpisode && !autoAdvanceCancelled && !prefersReducedMotion && autoplayNext && (!sync || sync.role === 'host')
    );

    const requestSeekTo = useCallback((positionSeconds: number) => {
        if (sync) sendPartyIntent({ kind: 'seek', positionSeconds });
        else if (playerRef.current) playerRef.current.currentTime = positionSeconds;
    }, [sendPartyIntent, sync]);

    const requestSeekBy = useCallback((seconds: number) => {
        const player = playerRef.current;
        if (!player) return;
        const positionSeconds = Math.min(
            durationRef.current || Number.POSITIVE_INFINITY,
            Math.max(0, player.currentTime + seconds),
        );
        requestSeekTo(positionSeconds);
        showSeekFeedback(seconds);
    }, [requestSeekTo, showSeekFeedback]);

    const requestPartyEpisode = useCallback((episodeKey: string | undefined, fallback?: () => void) => {
        if (sync) {
            if (episodeKey) sendPartyIntent({ kind: 'episode-change', episodeKey });
            return;
        }
        fallback?.();
    }, [sendPartyIntent, sync]);

    const handleNextEpisodeRequest = useCallback(() => {
        if (nextEpisodeCountdownActive) {
            setCancelledAutoAdvanceEpisode(episodeKey);
            return;
        }

        flushProgress();
        requestPartyEpisode(sync?.nextEpisodeKey, onNextEpisode);
    }, [episodeKey, flushProgress, nextEpisodeCountdownActive, onNextEpisode, requestPartyEpisode, sync?.nextEpisodeKey]);

    const handlePreviousEpisodeWithFlush = useCallback(() => {
        flushProgress();
        requestPartyEpisode(sync?.previousEpisodeKey, onPreviousEpisode);
    }, [flushProgress, onPreviousEpisode, requestPartyEpisode, sync?.previousEpisodeKey]);

    const handleSkipIntro = useCallback(() => {
        if (introEndSeconds !== null) requestSeekTo(introEndSeconds);
    }, [introEndSeconds, requestSeekTo]);

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
            const interruptedCountdown = nextEpisodeCountdownActive;

            if (interruptedCountdown) setCancelledAutoAdvanceEpisode(episodeKey);

            if (key === 's' && showSkipIntro) return;

            if (key === ' ' || key === 'k') {
                event.preventDefault();
                if (syncRef.current && !syncRef.current.canControl) showPartyControlDenied();
                else void requestPlaybackToggle(player, syncRef.current?.sendIntent).catch(() => undefined);
            } else if (key === 'arrowleft') {
                event.preventDefault();
                requestSeekBy(-5);
            } else if (key === 'arrowright') {
                event.preventDefault();
                requestSeekBy(5);
            } else if (key === 'j') {
                event.preventDefault();
                requestSeekBy(-10);
            } else if (key === 'l') {
                event.preventDefault();
                requestSeekBy(10);
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
                if (interruptedCountdown) return;
                handleNextEpisodeRequest();
            } else if (key === 'p' && onPreviousEpisode) {
                event.preventDefault();
                handlePreviousEpisodeWithFlush();
            } else if (/^[0-9]$/.test(key) && durationRef.current > 0) {
                event.preventDefault();
                requestSeekTo(durationRef.current * Number(key) / 10);
            } else if (key === 'escape' && !document.fullscreenElement && onBack) {
                event.preventDefault();
                handleBackWithFlush();
            }
        };

        document.addEventListener('keydown', handleKeyboard);
        return () => document.removeEventListener('keydown', handleKeyboard);
    }, [episodeKey, handleBackWithFlush, handleNextEpisodeRequest, handlePreviousEpisodeWithFlush, nextEpisodeCountdownActive, onBack, onNextEpisode, onPreviousEpisode, requestSeekBy, requestSeekTo, showPartyControlDenied, showSkipIntro]);

    useEffect(() => {
        if (!nextEpisodeCountdownActive) return;

        const cancelAutoAdvance = () => setCancelledAutoAdvanceEpisode(episodeKey);

        window.addEventListener('pointermove', cancelAutoAdvance);
        window.addEventListener('pointerdown', cancelAutoAdvance);
        window.addEventListener('click', cancelAutoAdvance);
        window.addEventListener('wheel', cancelAutoAdvance, { passive: true });

        return () => {
            window.removeEventListener('pointermove', cancelAutoAdvance);
            window.removeEventListener('pointerdown', cancelAutoAdvance);
            window.removeEventListener('click', cancelAutoAdvance);
            window.removeEventListener('wheel', cancelAutoAdvance);
        };
    }, [episodeKey, nextEpisodeCountdownActive]);

    useEffect(() => {
        nextEpisodeRef.current = onNextEpisode
            ? () => {
                flushProgress();
                requestPartyEpisode(sync?.nextEpisodeKey, onNextEpisode);
            }
            : undefined;
    }, [flushProgress, onNextEpisode, requestPartyEpisode, sync?.nextEpisodeKey]);

    useEffect(() => {
        if (!nextEpisodeCountdownActive) return;

        const timeout = setTimeout(() => {
            nextEpisodeRef.current?.();
        }, NEXT_EPISODE_AUTOPLAY_MS);

        return () => clearTimeout(timeout);
    }, [episodeKey, nextEpisodeCountdownActive]);

    const handleEnded = () => {
        flushProgress();
    };

    const handleRetry = () => {
        setMediaError(null);
        setManifestUnrecoverable(false);
        refreshAttemptsRef.current = 0;
        setMediaInstanceKey((value) => value + 1);
    };

    const mediaSrc = { src: activePlayback.src, type: 'application/vnd.apple.mpegurl' as const };

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
                onPlaying={clearBufferingReport}
                onWaiting={reportWaiting}
                onStalled={reportWaiting}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onError={handleError}
                onPause={flushProgress}
                onSeeking={() => { seekingRef.current = true; }}
                onSeeked={() => { seekingRef.current = false; }}
                playsInline
            >
                <MediaProvider>
                    {posterUrl && <Poster className="np-poster" src={posterUrl} alt={title} />}
                </MediaProvider>

                {sync ? (
                    <>
                        <div className="np-gesture np-gesture-fine" onPointerUp={() => {
                            const player = playerRef.current;
                            if (!player) return;
                            if (!sync.canControl) showPartyControlDenied();
                            else void requestPlaybackToggle(player, sync.sendIntent);
                        }} />
                        <div className="np-gesture np-gesture-coarse np-gesture-center" onPointerUp={() => {
                            const player = playerRef.current;
                            if (!player) return;
                            if (!sync.canControl) showPartyControlDenied();
                            else void requestPlaybackToggle(player, sync.sendIntent);
                        }} />
                        <div className="np-gesture np-gesture-coarse np-gesture-left" onDoubleClick={() => requestSeekBy(-10)} />
                        <div className="np-gesture np-gesture-coarse np-gesture-right" onDoubleClick={() => requestSeekBy(10)} />
                    </>
                ) : (
                    <>
                        <Gesture className="np-gesture np-gesture-fine" event="pointerup" action="toggle:paused" />
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
                    </>
                )}
                <Gesture className="np-gesture np-gesture-fine" event="dblpointerup" action="toggle:fullscreen" />

                <BufferingIndicator />
                <OverlaidPlayButton
                    seriesTitle={title}
                    seasonNumber={seasonNumber}
                    episodeNumber={episodeNumber}
                    episodeTitle={subtitle}
                    synopsis={episodeSynopsis}
                    onPlay={sync ? () => {
                        const player = playerRef.current;
                        if (!player) return;
                        if (!sync.canControl) showPartyControlDenied();
                        else void requestPlaybackToggle(player, sync.sendIntent);
                    } : undefined}
                />
                {sync && (
                    <PartyPlaybackGate
                        visible={sync.waitingForGesture}
                        onJoin={() => {
                            void resumePartyPlaybackAfterGesture(playerRef.current, sync.expectedPosition)
                                .then((joined) => sync.onWaitingForGestureChange(!joined));
                        }}
                    />
                )}
                {partyNotice && (
                    <div role="status" aria-live="polite" className="absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm text-white">
                        {partyNotice}
                    </div>
                )}
                <SeekFeedback feedback={seekFeedback} />
                <VolumeHud />

                {sync && (
                    <>
                        <PartyBufferingNotice wait={sync.bufferingWait} participants={sync.participants} />
                        <PartyParticipants
                            participants={sync.participants}
                            viewerProfileId={sync.viewerProfileId}
                            viewerRole={sync.role}
                            onTransferHost={(profileId) => { void sync.transferHost(profileId); }}
                            controlMode={sync.controlMode}
                            onControlModeChange={(controlMode) => { void sync.changeControlMode(controlMode); }}
                            lastAction={sync.lastAction}
                            syncQuality={sync.syncQuality}
                        />
                    </>
                )}

                {sync && (
                    <PartyChatPanel
                        messages={sync.chatMessages}
                        participants={sync.participants}
                        viewerProfileId={sync.viewerProfileId}
                        unreadCount={sync.unreadChatCount}
                        onSend={sync.sendChatMessage}
                        onOpenChange={sync.onChatOpenChange}
                    />
                )}

                <PlayerControls
                    heading={title}
                    kicker={kicker}
                    subheading={subtitle}
                    episodeNumber={episodeNumber}
                    onBack={onBack ? handleBackWithFlush : undefined}
                    onNextEpisode={onNextEpisode ? handleNextEpisodeRequest : undefined}
                    onPreviousEpisode={onPreviousEpisode ? handlePreviousEpisodeWithFlush : undefined}
                    onSeekFeedback={showSeekFeedback}
                    chapters={chapters}
                    partyControl={sync ? {
                        canControl: sync.canControl,
                        onToggle: () => {
                            const player = playerRef.current;
                            if (player) void requestPlaybackToggle(player, sync.sendIntent);
                        },
                        onSeekBy: requestSeekBy,
                        onSeekTo: requestSeekTo,
                        onControlDenied: showPartyControlDenied,
                    } : undefined}
                />

                <SkipIntroPill
                    visible={showSkipIntro && !showNextEpisode && !mediaError && !manifestUnrecoverable}
                    onSkip={handleSkipIntro}
                />

                {onNextEpisode && (
                    <NextEpisodePill
                        key={episodeKey}
                        visible={showNextEpisode && !mediaError && !manifestUnrecoverable}
                        countdownMs={NEXT_EPISODE_AUTOPLAY_MS}
                        countdownActive={nextEpisodeCountdownActive}
                        countdownCancelled={autoAdvanceCancelled}
                        episodesLeft={episodesLeft}
                        nextEpisodeTitle={nextEpisodeTitle}
                        onCancelCountdown={() => setCancelledAutoAdvanceEpisode(episodeKey)}
                        onNextEpisode={handleNextEpisodeRequest}
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
                                        Wróć do strony głównej
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
