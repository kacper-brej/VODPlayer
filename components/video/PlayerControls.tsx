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
import type { EpisodeChapter } from "@/lib/core/contracts";

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
    partyControl?: {
        canControl: boolean;
        onToggle: () => void;
        onSeekBy: (seconds: number) => void;
        onSeekTo: (seconds: number) => void;
        onControlDenied: () => void;
    };
}

interface PlayerOptionsMenuProps {
    onPreviousEpisode?: () => void;
    partyMode?: boolean;
}

const PlayerOptionsMenu = ({ onPreviousEpisode, partyMode = false }: PlayerOptionsMenuProps) => {
    const remote = useMediaRemote();
    const playbackRate = useMediaState("playbackRate");
    const qualities = useMediaState("qualities");
    const currentQuality = useMediaState("quality");
    const autoQuality = useMediaState("autoQuality");
    const sortedQualities = [...qualities].sort((a, b) => b.height - a.height);
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
                    {sortedQualities.length > 0 && (
                        <>
                            <span className="np-menu-label np-menu-label--section">
                                <Monitor />
                                Jakość
                            </span>
                            <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={autoQuality}
                                data-selected={autoQuality ? "" : undefined}
                                className="np-menu-item"
                                onClick={() => {
                                    remote.changeQuality(-1);
                                    setOpen(false);
                                    triggerRef.current?.focus();
                                }}
                            >
                                <span>Auto</span>
                                {autoQuality && <Check />}
                            </button>
                            {sortedQualities.map((quality) => {
                                const isSelected = !autoQuality && currentQuality?.height === quality.height;

                                return (
                                    <button
                                        key={quality.height}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={isSelected}
                                        data-selected={isSelected ? "" : undefined}
                                        className="np-menu-item"
                                        onClick={() => {
                                            const index = qualities.findIndex((item) => item.height === quality.height);
                                            if (index >= 0) remote.changeQuality(index);
                                            setOpen(false);
                                            triggerRef.current?.focus();
                                        }}
                                    >
                                        <span>{quality.height}p</span>
                                        {isSelected && <Check />}
                                    </button>
                                );
                            })}
                        </>
                    )}
                    <span className="np-menu-label np-menu-label--section">
                        <Gauge />
                        {partyMode ? "Prędkość sterowana przez pokój" : "Prędkość"}
                    </span>
                    {!partyMode && PLAYBACK_RATES.map((rate) => (
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
    partyControl,
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
    const currentTime = useMediaState("currentTime");
    const [partySeekTarget, setPartySeekTarget] = useState<number | null>(null);

    const runPartyControl = (action: () => void) => {
        if (!partyControl) return;
        if (!partyControl.canControl) {
            partyControl.onControlDenied();
            return;
        }
        action();
    };

    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
    const defaultEpisodeTitle = episodeNumber ? `Odcinek ${episodeNumber}` : null;
    const visibleSubheading = subheading && subheading !== defaultEpisodeTitle ? subheading : null;
    const nowPlayingEpisode = [
        episodeNumber ? `O${episodeNumber}` : kicker,
        visibleSubheading,
    ].filter(Boolean).join("  ");

    return (
        <Controls.Root className="np-shell" hideDelay={2500}>
            <Controls.Group className="np-top">
                {onBack && (
                    <button type="button" onClick={onBack} aria-label="Powrót do strony głównej" className="np-back">
                        <ArrowLeft />
                    </button>
                )}
                <div className="np-heading">
                    <span className="np-heading-title">{heading}</span>
                    {kicker && <span className="np-heading-kicker">{kicker}</span>}
                    {visibleSubheading && <span className="np-heading-subtitle">{visibleSubheading}</span>}
                </div>
            </Controls.Group>

            <div className="np-spacer" />

            <Controls.Group className="np-console">
                <TimeSlider.Root className="np-progress" aria-label="Pozycja odtwarzania" disabled={Boolean(partyControl)}>
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
                    {partyControl && duration > 0 && (
                        <input
                            type="range"
                            min={0}
                            max={duration}
                            step={0.1}
                            value={partySeekTarget ?? currentTime}
                            aria-label="Wspólna pozycja odtwarzania"
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => setPartySeekTarget(Number(event.currentTarget.value))}
                            onPointerUp={(event) => {
                                runPartyControl(() => partyControl.onSeekTo(Number(event.currentTarget.value)));
                                setPartySeekTarget(null);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            onKeyUp={(event) => {
                                event.stopPropagation();
                                runPartyControl(() => partyControl.onSeekTo(Number(event.currentTarget.value)));
                                setPartySeekTarget(null);
                            }}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        />
                    )}
                </TimeSlider.Root>

                <div className="np-console-row">
                    <div className="np-controls-group np-controls-group--left">
                        {partyControl ? (
                            <button
                                type="button"
                                className="np-control np-control--play"
                                aria-label={paused ? "Odtwórz wspólnie" : "Wstrzymaj wspólnie"}
                                onClick={() => runPartyControl(partyControl.onToggle)}
                            >
                                {ended ? <RotateCcw /> : paused ? <Play /> : <Pause />}
                            </button>
                        ) : (
                            <PlayButton className="np-control np-control--play" aria-label={paused ? "Odtwórz" : "Wstrzymaj"}>
                                {ended ? <RotateCcw /> : paused ? <Play /> : <Pause />}
                            </PlayButton>
                        )}

                        {partyControl ? (
                            <button
                                type="button"
                                className="np-control np-control--seek"
                                aria-label="Cofnij wspólnie o 10 sekund"
                                onClick={() => runPartyControl(() => partyControl.onSeekBy(-10))}
                            >
                                <span className="np-seek-icon" aria-hidden="true"><RotateCcw /><span>10</span></span>
                            </button>
                        ) : <SeekButton
                            className="np-control np-control--seek"
                            seconds={-10}
                            aria-label="Cofnij o 10 sekund"
                            onClick={() => onSeekFeedback?.(-10)}
                        >
                            <span className="np-seek-icon" aria-hidden="true">
                                <RotateCcw />
                                <span>10</span>
                            </span>
                        </SeekButton>}

                        {partyControl ? (
                            <button
                                type="button"
                                className="np-control np-control--seek"
                                aria-label="Przewiń wspólnie o 10 sekund"
                                onClick={() => runPartyControl(() => partyControl.onSeekBy(10))}
                            >
                                <span className="np-seek-icon" aria-hidden="true"><RotateCw /><span>10</span></span>
                            </button>
                        ) : <SeekButton
                            className="np-control np-control--seek"
                            seconds={10}
                            aria-label="Przewiń o 10 sekund"
                            onClick={() => onSeekFeedback?.(10)}
                        >
                            <span className="np-seek-icon" aria-hidden="true">
                                <RotateCw />
                                <span>10</span>
                            </span>
                        </SeekButton>}

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
                            onPointerDown={(event) => event.stopPropagation()}
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

                        <PlayerOptionsMenu onPreviousEpisode={onPreviousEpisode} partyMode={Boolean(partyControl)} />

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
