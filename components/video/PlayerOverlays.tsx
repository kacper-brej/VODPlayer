"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlayButton, useMediaState } from '@vidstack/react';
import { Play, RotateCcw, RotateCw, SkipForward, StepForward, Volume1, Volume2, VolumeX } from 'lucide-react';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const PILL_CLASS =
    'group relative px-6 py-3 md:px-8 md:py-4 bg-[#030712]/80 hover:bg-primary-hover border border-white/10 hover:border-primary-hover ' +
    'text-slate-200 hover:text-white rounded-full transition-transform duration-500 backdrop-blur-xl flex items-center gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.6)]' +
    'hover:shadow-[0_0_50px_rgba(139,92,246,0.8)] hover:scale-[1.03] overflow-hidden cursor-pointer pointer-events-auto';

const PILL_ICON_CLASS =
    'relative z-10 bg-primary/20 p-2.5 rounded-full group-hover:bg-white/20 transition-colors shadow-inner text-primary-hover group-hover:text-white';

const PILL_TITLE_CLASS =
    'text-xs md:text-sm font-bold uppercase tracking-[0.2em] leading-none text-slate-200';

const PILL_SUB_CLASS =
    'text-[9px] md:text-[10px] font-bold mt-1.5 tracking-widest uppercase group-hover:text-primary-hover text-primary-hover';

const PILL_NOTE_CLASS =
    'block max-w-[220px] md:max-w-[340px] truncate px-5 text-center text-[10px] md:text-xs font-semibold tracking-wide text-slate-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]';

const NEXT_TITLE_CLASS =
    'block max-w-[220px] md:max-w-[340px] truncate px-5 text-center text-sm md:text-base font-bold tracking-wide text-slate-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]';

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
    episodesLeft?: number;
    nextEpisodeTitle?: string;
    onNextEpisode: () => void;
}

export const NextEpisodePill = ({
    visible,
    countdownMs,
    countdownActive,
    episodesLeft,
    nextEpisodeTitle,
    onNextEpisode,
}: NextEpisodePillProps) => {
    const totalSeconds = Math.ceil(countdownMs / 1000);
    const [remaining, setRemaining] = useState(totalSeconds);
    const [prevCountdownActive, setPrevCountdownActive] = useState(countdownActive);

    if (countdownActive !== prevCountdownActive) {
        setPrevCountdownActive(countdownActive);
        setRemaining(totalSeconds);
    }

    useEffect(() => {
        if (!countdownActive) return;

        const interval = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);

        return () => clearInterval(interval);
    }, [countdownActive]);

    const episodesNote = typeof episodesLeft === 'number' ? formatEpisodesLeft(episodesLeft) : null;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="absolute bottom-32 md:bottom-40 right-6 md:right-12 z-[60] flex flex-col items-center gap-2 pointer-events-auto max-w-[calc(100%-3rem)]"
                    initial={{ opacity: 0, y: 32, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 32, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                    {nextEpisodeTitle && <span className={NEXT_TITLE_CLASS}>{nextEpisodeTitle}</span>}

                    <button type="button" onClick={onNextEpisode} className={PILL_CLASS}>
                        {countdownActive && (
                            <motion.span
                                className="absolute left-0 top-0 bottom-0 w-full origin-left bg-primary/40 z-0 will-change-transform"
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: countdownMs / 1000, ease: 'linear' }}
                            />
                        )}

                        <div className={PILL_ICON_CLASS}>
                            <StepForward size={18} />
                        </div>

                        <div className="relative z-10 flex flex-col text-left pr-2">
                            <span className={PILL_TITLE_CLASS}>Następny odcinek</span>
                            {countdownActive && (
                                <span className={PILL_SUB_CLASS}>Załaduje się za {remaining}s...</span>
                            )}
                        </div>
                    </button>

                    {episodesNote && <span className={PILL_NOTE_CLASS}>{episodesNote}</span>}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
