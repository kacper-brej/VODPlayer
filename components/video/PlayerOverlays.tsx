"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlayButton, useMediaState } from '@vidstack/react';
import { Play, RotateCcw, RotateCw, SkipForward, StepForward, Volume1, Volume2, VolumeX } from 'lucide-react';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const formatEpisodesLeft = (count: number) => {
    if (count === 1) return 'ostatni odcinek';
    if (count === 2 || count === 3) return `${count} odcinki do końca`;
    return null;
};

interface OverlaidPlayButtonProps {
    seriesTitle: string;
    seasonNumber?: number | null;
    episodeNumber?: number;
    episodeTitle?: string;
    synopsis?: string | null;
}

export const OverlaidPlayButton = ({
    seriesTitle,
    seasonNumber,
    episodeNumber,
    episodeTitle,
    synopsis,
}: OverlaidPlayButtonProps) => {
    const paused = useMediaState('paused');
    const ended = useMediaState('ended');
    const canPlay = useMediaState('canPlay');
    const waiting = useMediaState('waiting');
    const started = useMediaState('started');
    const defaultEpisodeTitle = episodeNumber ? `Odcinek ${episodeNumber}` : null;
    const episodeLine = episodeTitle && episodeTitle !== defaultEpisodeTitle
        ? `${episodeTitle}${episodeNumber ? ` · odc. ${episodeNumber}` : ''}`
        : defaultEpisodeTitle;

    return (
        <AnimatePresence>
            {paused && !ended && canPlay && !waiting && (
                <motion.div
                    className="np-overlaid-play-layer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                    <div className="np-pause-scrim" />
                    {started && (
                        <motion.div
                            className="np-pause-copy"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.28, ease: EASE_OUT }}
                        >
                            <span className="np-pause-kicker">Oglądasz</span>
                            <h2>{seriesTitle}</h2>
                            {seasonNumber !== null && seasonNumber !== undefined && (
                                <span className="np-pause-season">Sezon {seasonNumber}</span>
                            )}
                            {episodeLine && <h3>{episodeLine}</h3>}
                            {synopsis && <p>{synopsis}</p>}
                        </motion.div>
                    )}
                    <PlayButton className="np-overlaid-play" aria-label="Odtwórz">
                        <Play />
                    </PlayButton>
                    {started && <span className="np-pause-status">Wstrzymane</span>}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

interface SeekFeedbackProps {
    feedback: {
        direction: 'backward' | 'forward';
        seconds: number;
        id: number;
    } | null;
}

export const SeekFeedback = ({ feedback }: SeekFeedbackProps) => (
    <div className="np-seek-feedback-layer" aria-live="polite">
        <AnimatePresence>
            {feedback && (
                <motion.div
                    key={feedback.id}
                    className="np-seek-feedback"
                    data-direction={feedback.direction}
                    initial={{ opacity: 0, x: feedback.direction === 'backward' ? 22 : -22, scale: 0.92 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.24, ease: EASE_OUT }}
                >
                    <motion.span
                        initial={{ rotate: feedback.direction === 'backward' ? 30 : -30 }}
                        animate={{ rotate: 0 }}
                        transition={{ duration: 0.32, ease: EASE_OUT }}
                    >
                        {feedback.direction === 'backward' ? <RotateCcw /> : <RotateCw />}
                    </motion.span>
                    <strong>{feedback.seconds} s</strong>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

export const BufferingIndicator = () => {
    const waiting = useMediaState('waiting');
    const canPlay = useMediaState('canPlay');
    const buffering = waiting || !canPlay;
    const [delayElapsed, setDelayElapsed] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => setDelayElapsed(buffering), buffering ? 400 : 0);
        return () => clearTimeout(timeout);
    }, [buffering]);

    return (
        <AnimatePresence>
            {buffering && delayElapsed && (
                <motion.div
                    className="np-buffering"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                    <span className="np-buffering-ring" />
                    <span className="np-buffering-label">Ładowanie</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const VolumeHud = () => {
    const volume = useMediaState('volume');
    const muted = useMediaState('muted');
    const [visible, setVisible] = useState(false);
    const isInitialRender = useRef(true);

    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }

        setVisible(true);
        const timeout = setTimeout(() => setVisible(false), 1500);

        return () => clearTimeout(timeout);
    }, [volume, muted]);

    const value = muted ? 0 : volume;
    const percent = Math.round(value * 100);

    return (
        <div className="np-volume-hud-layer">
            <AnimatePresence>
                {visible && (
                    <motion.div
                        className="np-volume-hud"
                        initial={{ opacity: 0, y: -16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                    >
                        {value === 0 ? (
                            <VolumeX />
                        ) : value < 0.5 ? (
                            <Volume1 />
                        ) : (
                            <Volume2 />
                        )}
                        <div className="np-volume-hud-track">
                            <div
                                className="np-volume-hud-fill"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <span>{percent}%</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface SkipIntroPillProps {
    visible: boolean;
    onSkip: () => void;
}

export const SkipIntroPill = ({ visible, onSkip }: SkipIntroPillProps) => (
    <AnimatePresence>
        {visible && (
            <motion.div
                className="np-skip-intro-layer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
            >
                <button
                    type="button"
                    onClick={onSkip}
                    aria-keyshortcuts="S"
                    className="np-skip-intro"
                >
                    <SkipForward />
                    <span>Pomiń czołówkę</span>
                </button>
            </motion.div>
        )}
    </AnimatePresence>
);

interface NextEpisodePillProps {
    visible: boolean;
    countdownMs: number;
    countdownActive: boolean;
    countdownCancelled: boolean;
    episodesLeft?: number;
    nextEpisodeTitle?: string;
    onCancelCountdown: () => void;
    onNextEpisode: () => void;
}

const NextEpisodeCountdown = ({ countdownMs }: { countdownMs: number }) => {
    const [remaining, setRemaining] = useState(() => Math.ceil(countdownMs / 1000));

    useEffect(() => {
        const startedAt = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            setRemaining(Math.max(0, Math.ceil((countdownMs - elapsed) / 1000)));
        }, 250);

        return () => clearInterval(interval);
    }, [countdownMs]);

    return <>Następny odcinek za {remaining}s</>;
};

export const NextEpisodePill = ({
    visible,
    countdownMs,
    countdownActive,
    countdownCancelled,
    episodesLeft,
    nextEpisodeTitle,
    onCancelCountdown,
    onNextEpisode,
}: NextEpisodePillProps) => {
    const episodesNote = typeof episodesLeft === 'number' ? formatEpisodesLeft(episodesLeft) : null;
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();

        if (countdownActive) {
            onCancelCountdown();
            return;
        }

        onNextEpisode();
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="np-next-episode-layer"
                    initial={{ opacity: 0, y: 32, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 32, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                    {nextEpisodeTitle && <span className="np-next-episode-title">{nextEpisodeTitle}</span>}

                    <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleClick}
                        className="np-next-episode"
                        aria-label={countdownActive
                            ? 'Zatrzymaj odliczanie do następnego odcinka'
                            : 'Odtwórz następny odcinek'}
                    >
                        {(countdownActive || countdownCancelled) && (
                            <motion.span
                                key={countdownActive ? 'countdown-active' : 'countdown-cancelled'}
                                className="np-next-episode-fill"
                                initial={{ scaleX: countdownActive ? 0 : 1 }}
                                animate={{ scaleX: 1 }}
                                transition={{
                                    duration: countdownActive ? countdownMs / 1000 : 0,
                                    ease: 'linear',
                                }}
                            />
                        )}

                        <span className="np-next-episode-icon" aria-hidden="true">
                            <StepForward size={18} />
                        </span>

                        <span className="np-next-episode-copy" aria-live="polite">
                            <span className="np-next-episode-label">
                                {countdownActive
                                    ? <NextEpisodeCountdown countdownMs={countdownMs} />
                                    : 'Następny odcinek'}
                            </span>
                            {countdownCancelled && (
                                <span className="np-next-episode-hint">Kliknij, aby odtworzyć</span>
                            )}
                        </span>
                    </button>

                    {episodesNote && <span className="np-next-episode-note">{episodesNote}</span>}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
