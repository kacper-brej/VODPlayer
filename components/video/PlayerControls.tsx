"use client";

import { useEffect, useRef, useState } from 'react';
import {
    Controls,
    FullscreenButton,
    MuteButton,
    PIPButton,
    PlayButton,
    SeekButton,
    Time,
    TimeSlider,
    VolumeSlider,
    useMediaRemote,
    useMediaState,
} from '@vidstack/react';
import {
    ArrowLeft,
    Check,
    FastForward,
    Gauge,
    Maximize,
    Minimize,
    Pause,
    PictureInPicture2,
    Play,
    Rewind,
    RotateCcw,
    SkipBack,
    SkipForward,
    Volume1,
    Volume2,
    VolumeX,
} from 'lucide-react';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlayerControlsProps {
    heading: string;
    subheading?: string;
    onBack?: () => void;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
}

const PlaybackRateMenu = () => {
    const remote = useMediaRemote();
    const playbackRate = useMediaState('playbackRate');
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    return (
        <div className="np-menu" ref={menuRef}>
            <button
                type="button"
                className="np-control"
                onClick={() => setOpen((value) => !value)}
                data-open={open ? '' : undefined}
                aria-label="Prędkość odtwarzania"
                aria-expanded={open}
            >
                <Gauge size={18} />
            </button>

            {open && (
                <div className="np-menu-panel" role="menu">
                    <span className="np-menu-label">Prędkość</span>
                    {PLAYBACK_RATES.map((rate) => (
                        <button
                            key={rate}
                            type="button"
                            role="menuitemradio"
                            aria-checked={rate === playbackRate}
                            data-selected={rate === playbackRate ? '' : undefined}
                            className="np-menu-item"
                            onClick={() => {
                                remote.changePlaybackRate(rate);
                                setOpen(false);
                            }}
                        >
                            <span>{rate === 1 ? 'Normalna' : `${rate}×`}</span>
                            {rate === playbackRate && <Check size={15} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const PlayerControls = ({ heading, subheading, onBack, onNextEpisode, onPreviousEpisode }: PlayerControlsProps) => {
    const paused = useMediaState('paused');
    const ended = useMediaState('ended');
    const muted = useMediaState('muted');
    const volume = useMediaState('volume');
    const canSetVolume = useMediaState('canSetVolume');
    const fullscreen = useMediaState('fullscreen');
    const canFullscreen = useMediaState('canFullscreen');
    const canPictureInPicture = useMediaState('canPictureInPicture');

    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    return (
        <Controls.Root className="np-shell" hideDelay={2600}>
            <Controls.Group className="np-top">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Powrót"
                        className="w-12 h-12 md:w-14 md:h-14 bg-[#030712]/60 hover:bg-white hover:text-black hover:scale-110 border border-white/10 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl cursor-pointer pointer-events-auto shrink-0 text-slate-200"
                    >
                        <ArrowLeft size={24} />
                    </button>
                )}

                <div className="flex flex-col min-w-0 gap-1">
                    <span className="text-sm md:text-base font-bold tracking-wide text-white truncate drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                        {heading}
                    </span>
                    {subheading && (
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-primary-hover">
                            {subheading}
                        </span>
                    )}
                </div>
            </Controls.Group>

            <div className="np-spacer" />

            <Controls.Group className="np-controls">
                <PlayButton className="np-control">
                    {ended ? (
                        <RotateCcw size={18} />
                    ) : paused ? (
                        <Play size={18} className="fill-current" />
                    ) : (
                        <Pause size={18} className="fill-current" />
                    )}
                </PlayButton>

                {onPreviousEpisode && (
                    <button
                        type="button"
                        onClick={onPreviousEpisode}
                        className="np-control np-control--hide-sm"
                        aria-label="Poprzedni odcinek"
                    >
                        <SkipBack size={18} className="fill-current" />
                    </button>
                )}

                <SeekButton className="np-control np-control--hide-sm" seconds={-10} aria-label="Cofnij o 10 sekund">
                    <Rewind size={18} />
                </SeekButton>

                <SeekButton className="np-control np-control--hide-sm" seconds={10} aria-label="Przewiń o 10 sekund">
                    <FastForward size={18} />
                </SeekButton>

                {onNextEpisode && (
                    <button
                        type="button"
                        onClick={onNextEpisode}
                        className="np-control"
                        aria-label="Następny odcinek"
                    >
                        <SkipForward size={18} className="fill-current" />
                    </button>
                )}

                <TimeSlider.Root className="np-progress">
                    <TimeSlider.Track className="np-range-track">
                        <TimeSlider.Progress className="np-range-buffer" />
                        <TimeSlider.TrackFill className="np-range-fill" />
                    </TimeSlider.Track>
                    <TimeSlider.Thumb className="np-range-thumb" />
                    <TimeSlider.Preview className="np-preview">
                        <TimeSlider.Value className="np-preview-value" />
                    </TimeSlider.Preview>
                </TimeSlider.Root>

                <Time className="np-time" type="current" />
                <Time className="np-time" type="duration" />

                <div className="np-volume">
                    <MuteButton className="np-control">
                        <VolumeIcon size={18} />
                    </MuteButton>

                    {canSetVolume && (
                        <VolumeSlider.Root className="np-volume-slider" aria-label="Głośność">
                            <VolumeSlider.Track className="np-range-track">
                                <VolumeSlider.TrackFill className="np-range-fill" />
                            </VolumeSlider.Track>
                            <VolumeSlider.Thumb className="np-range-thumb" />
                        </VolumeSlider.Root>
                    )}
                </div>

                <PlaybackRateMenu />

                {canPictureInPicture && (
                    <PIPButton className="np-control np-control--hide-sm">
                        <PictureInPicture2 size={18} />
                    </PIPButton>
                )}

                {canFullscreen && (
                    <FullscreenButton className="np-control">
                        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                    </FullscreenButton>
                )}
            </Controls.Group>
        </Controls.Root>
    );
};

export default PlayerControls;
