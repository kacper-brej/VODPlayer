"use client";

import { useEffect, useRef, useState } from "react";
import {
    CaptionButton,
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
} from "@vidstack/react";
import {
    ArrowLeft,
    Captions,
    Check,
    Gauge,
    Maximize,
    Minimize,
    Monitor,
    Pause,
    PictureInPicture2,
    Play,
    RotateCcw,
    RotateCw,
    Settings,
    SkipBack,
    SkipForward,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import type { EpisodeChapter } from "@/lib/contracts";

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface PlayerControlsProps {
    heading: string;
    kicker?: string;
    subheading?: string;
    episodeNumber?: number;
    onBack?: () => void;
    onNextEpisode?: () => void;
    onPreviousEpisode?: () => void;
    onSeekFeedback?: (seconds: number) => void;
    chapters?: EpisodeChapter[];
}

interface PlayerOptionsMenuProps {
    onPreviousEpisode?: () => void;
}

const PlayerOptionsMenu = ({ onPreviousEpisode }: PlayerOptionsMenuProps) => {
    const remote = useMediaRemote();
    const playbackRate = useMediaState("playbackRate");
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    return (
        <div className="np-menu" ref={menuRef}>
            <button
                ref={triggerRef}
                type="button"
                className="np-control"
                onClick={() => setOpen((value) => !value)}
                data-open={open ? "" : undefined}
                aria-label="Więcej ustawień"
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <Settings />
            </button>

            {open && (
                <div className="np-menu-panel" role="menu" aria-label="Ustawienia odtwarzacza">
                    {onPreviousEpisode && (
                        <button
                            type="button"
                            role="menuitem"
                            className="np-menu-item"
                            onClick={() => {
                                onPreviousEpisode();
                                setOpen(false);
                            }}
                        >
                            <span>Poprzedni odcinek</span>
                            <SkipBack />
                        </button>
                    )}
                    <span className="np-menu-label">Odtwarzanie</span>
                    <div className="np-menu-status" aria-label="Jakość oryginalna">
                        <Monitor />
                        <span>Jakość</span>
                        <span>Oryginalna</span>
                    </div>
                    <span className="np-menu-label np-menu-label--section">
                        <Gauge />
                        Prędkość
                    </span>
                    {PLAYBACK_RATES.map((rate) => (
                        <button
                            key={rate}
                            type="button"
                            role="menuitemradio"
                            aria-checked={rate === playbackRate}
                            data-selected={rate === playbackRate ? "" : undefined}
                            className="np-menu-item"
                            onClick={() => {
                                remote.changePlaybackRate(rate);
                                setOpen(false);
                                triggerRef.current?.focus();
                            }}
                        >
                            <span>{rate === 1 ? "Normalna" : `${rate}×`}</span>
                            {rate === playbackRate && <Check />}
                        </button>
                    ))}
                    <div className="np-shortcuts" aria-label="Najważniejsze skróty klawiaturowe">
                        <span>Spacja / K</span><span>odtwarzanie</span>
                        <span>J / L</span><span>±10 sekund</span>
                        <span>M / F</span><span>dźwięk / pełny ekran</span>
                        <span>S / P / N</span><span>czołówka / odcinki</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const PlayerControls = ({
    heading,
    kicker,
    subheading,
    episodeNumber,
    onBack,
    onNextEpisode,
    onPreviousEpisode,
    onSeekFeedback,
    chapters = [],
}: PlayerControlsProps) => {
    const paused = useMediaState("paused");
    const ended = useMediaState("ended");
    const muted = useMediaState("muted");
    const volume = useMediaState("volume");
    const canSetVolume = useMediaState("canSetVolume");
    const fullscreen = useMediaState("fullscreen");
    const canFullscreen = useMediaState("canFullscreen");
    const canPictureInPicture = useMediaState("canPictureInPicture");
    const duration = useMediaState("duration");

    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
    const defaultEpisodeTitle = episodeNumber ? `Odcinek ${episodeNumber}` : null;
    const nowPlayingEpisode = [
        episodeNumber ? `O${episodeNumber}` : kicker,
        subheading && subheading !== defaultEpisodeTitle ? subheading : null,
    ].filter(Boolean).join("  ");

    return (
        <Controls.Root className="np-shell" hideDelay={2500}>
            <Controls.Group className="np-top">
                {onBack && (
                    <button type="button" onClick={onBack} aria-label="Powrót do serialu" className="np-back">
                        <ArrowLeft />
                    </button>
                )}
                <div className="np-heading">
                    {kicker && <span className="np-heading-kicker">{kicker}</span>}
                    <span className="np-heading-title">{heading}</span>
                    {subheading && <span className="np-heading-subtitle">{subheading}</span>}
                </div>
            </Controls.Group>

            <div className="np-spacer" />

            <Controls.Group className="np-console">
                <TimeSlider.Root className="np-progress" aria-label="Pozycja odtwarzania">
                    <TimeSlider.Track className="np-range-track">
                        <TimeSlider.Progress className="np-range-buffer" />
                        <TimeSlider.TrackFill className="np-range-fill" />
                        {duration > 0 && chapters.flatMap((chapter) => [
                            <span
                                key={`${chapter.type}-start-${chapter.startSeconds}`}
                                aria-hidden="true"
                                className="np-chapter-marker"
                                data-chapter-type={chapter.type}
                                style={{ left: `${Math.min(100, Math.max(0, chapter.startSeconds / duration * 100))}%` }}
                            />,
                            <span
                                key={`${chapter.type}-end-${chapter.endSeconds}`}
                                aria-hidden="true"
                                className="np-chapter-marker"
                                data-chapter-type={chapter.type}
                                style={{ left: `${Math.min(100, Math.max(0, chapter.endSeconds / duration * 100))}%` }}
                            />,
                        ])}
                    </TimeSlider.Track>
                    <TimeSlider.Thumb className="np-range-thumb" />
                    <TimeSlider.Preview className="np-preview">
                        <TimeSlider.Value className="np-preview-value" />
                    </TimeSlider.Preview>
                </TimeSlider.Root>

                <div className="np-console-row">
                    <div className="np-controls-group np-controls-group--left">
                        <PlayButton className="np-control np-control--play" aria-label={paused ? "Odtwórz" : "Wstrzymaj"}>
                            {ended ? <RotateCcw /> : paused ? <Play /> : <Pause />}
                        </PlayButton>

                        <SeekButton
                            className="np-control np-control--seek"
                            seconds={-10}
                            aria-label="Cofnij o 10 sekund"
                            onClick={() => onSeekFeedback?.(-10)}
                        >
                            <span className="np-seek-icon" aria-hidden="true">
                                <RotateCcw />
                                <span>10</span>
                            </span>
                        </SeekButton>

                        <SeekButton
                            className="np-control np-control--seek"
                            seconds={10}
                            aria-label="Przewiń o 10 sekund"
                            onClick={() => onSeekFeedback?.(10)}
                        >
                            <span className="np-seek-icon" aria-hidden="true">
                                <RotateCw />
                                <span>10</span>
                            </span>
                        </SeekButton>

                        <div className="np-volume">
                            <MuteButton className="np-control" aria-label={muted ? "Włącz dźwięk" : "Wycisz"}>
                                <VolumeIcon />
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

                        <div className="np-time-group" aria-label="Czas odtwarzania">
                            <Time className="np-time" type="current" />
                            <span aria-hidden="true">/</span>
                            <Time className="np-time np-time--duration" type="duration" />
                        </div>
                    </div>

                    <div className="np-now-playing" title={`${heading}${nowPlayingEpisode ? ` — ${nowPlayingEpisode}` : ""}`}>
                        <span>{heading}</span>
                        {nowPlayingEpisode && <span>{nowPlayingEpisode}</span>}
                    </div>

                    <div className="np-controls-group np-controls-group--right">
                        <button
                            type="button"
                            onClick={onNextEpisode}
                            className="np-control"
                            aria-label={onNextEpisode ? "Następny odcinek" : "To ostatni odcinek"}
                            aria-disabled={!onNextEpisode}
                        >
                            <SkipForward />
                        </button>

                        <CaptionButton className="np-control np-control--hide-mobile" aria-label="Napisy">
                            <Captions />
                        </CaptionButton>

                        <PlayerOptionsMenu onPreviousEpisode={onPreviousEpisode} />

                        {canPictureInPicture && (
                            <PIPButton className="np-control np-control--hide-tablet" aria-label="Obraz w obrazie">
                                <PictureInPicture2 />
                            </PIPButton>
                        )}

                        {canFullscreen && (
                            <FullscreenButton className="np-control" aria-label={fullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}>
                                {fullscreen ? <Minimize /> : <Maximize />}
                            </FullscreenButton>
                        )}
                    </div>
                </div>
            </Controls.Group>
        </Controls.Root>
    );
};

export default PlayerControls;
