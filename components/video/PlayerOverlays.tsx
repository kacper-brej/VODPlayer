"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlayButton, useMediaState } from '@vidstack/react';
import { FastForward, Play, StepForward, Volume1, Volume2, VolumeX } from 'lucide-react';

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const PILL_CLASS =
    'group relative px-6 py-3 md:px-8 md:py-4 bg-[#030712]/80 hover:bg-primary-hover border border-white/10 hover:border-primary-hover text-slate-200 hover:text-white rounded-full transition-all duration-500 backdrop-blur-xl flex items-center gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_0_50px_rgba(139,92,246,0.8)] hover:scale-105 overflow-hidden cursor-pointer pointer-events-auto';

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

export const OverlaidPlayButton = () => {
    const paused = useMediaState('paused');
    const ended = useMediaState('ended');
    const canPlay = useMediaState('canPlay');

    return (
        <AnimatePresence>
            {paused && !ended && canPlay && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                    <PlayButton className="np-control np-control--overlaid">
                        <Play className="fill-current" />
                    </PlayButton>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export const BufferingIndicator = () => {
    const waiting = useMediaState('waiting');
    const canPlay = useMediaState('canPlay');

    return (
        <AnimatePresence>
            {(waiting || !canPlay) && (
                <motion.div
                    className="np-buffering"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                    <span className="np-buffering-ring" />
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
        <div className="absolute top-12 left-0 right-0 z-[65] flex justify-center pointer-events-none">
            <AnimatePresence>
                {visible && (
                    <motion.div
                        className="bg-[#030712]/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-4 text-white shadow-[0_10px_40px_rgba(0,0,0,0.8)]"
                        initial={{ opacity: 0, y: -16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -16, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                    >
                        {value === 0 ? (
                            <VolumeX size={20} className="text-primary-hover" />
                        ) : value < 0.5 ? (
                            <Volume1 size={20} className="text-primary-hover" />
                        ) : (
                            <Volume2 size={20} className="text-primary-hover" />
                        )}
                        <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-200"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <span className="font-bold text-[10px] uppercase tracking-widest w-10 text-right">
                            {percent}%
                        </span>
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
                className="absolute bottom-32 md:bottom-40 left-6 md:left-12 z-[60] pointer-events-auto"
                initial={{ opacity: 0, y: 32, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 32, scale: 0.95 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
            >
                <button type="button" onClick={onSkip} className={PILL_CLASS}>
                    <div className={PILL_ICON_CLASS}>
                        <FastForward size={18} />
                    </div>
                    <span className={PILL_TITLE_CLASS}>Pomiń czołówkę</span>
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
