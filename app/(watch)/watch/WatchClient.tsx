"use client"
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import saveProgressAction from "@/lib/progress/saveProgressAction";
import PlayerErrorBoundary from "@/components/video/PlayerErrorBoundary";
import { partyWatchPath, seriesPath, watchPath } from "@/lib/core/routes";
import type { EpisodeChapter, WatchPartyMember, WatchPartyMessage } from "@/lib/core/contracts";
import type { PlaybackSource } from "@/lib/player/videoAccess";
import { usePartySync } from "@/lib/party/usePartySync";
import { partyEventFromResponse } from "@/lib/party/partyEvents";
import type { PartyPlaybackAdapter } from "@/lib/party/partyPlayerAdapter";
import type { VideoPlayerProps, VideoPlayerSync } from "@/components/video/VideoPlayer";

const VideoPlayer = dynamic(
    () => import("@/components/video/VideoPlayer").then((mod) => mod.VideoPlayer),
    {
        ssr: false,
        loading: () => (
            <div className="np-player-loading" role="status">
                <span className="np-player-loading-ring" />
                <span>Ładowanie odtwarzacza</span>
            </div>
        ),
    }
);

interface WatchClientProps {
    playback: PlaybackSource;
    seriesTitle: string;
    episodeTitle: string;
    seasonNumber: number | null;
    episodeSynopsis: string | null;
    seriesId: number;
    seriesKey: string;
    currentEpisode: number;
    totalEpisodes: number;
    fileName: string;
    startTime: number;
    nextEpisodeTitle?: string;
    chapters: EpisodeChapter[];
    autoplayNext: boolean;
    skipIntroPrompt: boolean;
    defaultVolume: number;
    isDemo?: boolean;
    partyCode?: string;
    episodeKeys: Array<{ key: string; number: number }>;
    nextEpisodeKey?: string;
    previousEpisodeKey?: string;
}

interface PartyVideoPlayerProps {
    code: string;
    playerProps: VideoPlayerProps;
    seriesId: number;
    episodeKeys: Array<{ key: string; number: number }>;
    nextEpisodeKey?: string;
    previousEpisodeKey?: string;
}

const PartyInviteLink = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        const link = typeof window === "undefined" ? "" : window.location.href;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="np-party-invite">
            <span className="np-party-invite-code">{code}</span>
            <button type="button" onClick={copy} className="np-party-invite-copy">
                {copied ? "Skopiowano" : "Kopiuj link"}
            </button>
        </div>
    );
};

interface PartyJoinConfirmProps {
    code: string;
    title: string;
    kicker?: string;
    subtitle?: string;
    participants: WatchPartyMember[];
    onConfirm: () => void;
}

const PartyJoinConfirm = ({ code, title, kicker, subtitle, participants, onConfirm }: PartyJoinConfirmProps) => (
    <div className="np-party-confirm" role="status">
        <div className="np-party-confirm-panel">
            <p className="np-party-confirm-kicker">Wspólne oglądanie</p>
            <h1>{title}</h1>
            {(kicker || subtitle) && (
                <p className="np-party-confirm-episode">{[kicker, subtitle].filter(Boolean).join(" · ")}</p>
            )}
            {participants.length > 0 && (
                <p className="np-party-confirm-members">
                    W pokoju: {participants.map((participant) => participant.name).join(", ")}
                </p>
            )}
            <PartyInviteLink code={code} />
            <button type="button" className="np-party-confirm-button" onClick={onConfirm}>
                Dołącz do pokoju
            </button>
        </div>
    </div>
);

const PartyClosedScreen = ({ onLeave }: { onLeave: () => void }) => (
    <div className="np-party-confirm" role="alert">
        <div className="np-party-confirm-panel">
            <p className="np-party-confirm-kicker">Pokój zamknięty</p>
            <h1>Host zamknął pokój</h1>
            <p className="np-party-confirm-episode">
                Możesz oglądać dalej samodzielnie od ostatniego miejsca.
            </p>
            <button type="button" className="np-party-confirm-button" onClick={onLeave}>
                Kontynuuj samodzielnie
            </button>
        </div>
    </div>
);

const PARTY_CONNECTION_LABEL: Record<string, string> = {
    connecting: "Łączenie z pokojem…",
    reconnecting: "Ponowne łączenie z pokojem…",
    disconnected: "Rozłączono z pokojem. Możesz oglądać dalej samodzielnie.",
};

const PartySyncedVideoPlayer = ({
    code,
    playerProps,
    seriesId,
    episodeKeys,
    nextEpisodeKey,
    previousEpisodeKey,
}: PartyVideoPlayerProps) => {
    const router = useRouter();
    const adapterRef = useRef<PartyPlaybackAdapter | null>(null);
    const [waitingForGesture, setWaitingForGesture] = useState(false);
    const lastKnownPositionRef = useRef<number | null>(null);
    const readPlayback = useCallback(() => {
        const snapshot = adapterRef.current?.read() ?? null;
        if (snapshot) lastKnownPositionRef.current = snapshot.positionSeconds;
        return snapshot;
    }, []);
    const applyCorrection = useCallback((decision: Parameters<PartyPlaybackAdapter["correct"]>[0]) => {
        adapterRef.current?.correct(decision);
    }, []);
    const registerPlaybackAdapter = useCallback((adapter: PartyPlaybackAdapter | null) => {
        adapterRef.current = adapter;
    }, []);
    const party = usePartySync(code, { readPlayback, onCorrection: applyCorrection });
    const [confirmed, setConfirmed] = useState(false);
    const [recoveredStartTime, setRecoveredStartTime] = useState<number | null>(null);

    useEffect(() => {
        if (party.connectionStatus === "disconnected") {
            setRecoveredStartTime(lastKnownPositionRef.current);
        }
    }, [party.connectionStatus]);

    const [chatMessages, setChatMessages] = useState<WatchPartyMessage[]>([]);
    const [seenChatHistory, setSeenChatHistory] = useState<WatchPartyMessage[] | undefined>(undefined);
    const [lastProcessedChatEvent, setLastProcessedChatEvent] = useState<typeof party.lastEvent>(null);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const incomingChatHistory = party.room?.messages;
    if (incomingChatHistory && incomingChatHistory !== seenChatHistory) {
        setSeenChatHistory(incomingChatHistory);
        setChatMessages(incomingChatHistory);
    }

    if (party.lastEvent && party.lastEvent !== lastProcessedChatEvent) {
        setLastProcessedChatEvent(party.lastEvent);
        if (party.lastEvent.type === "chat") {
            const message = party.lastEvent.message;
            if (!chatMessages.some((existing) => existing.id === message.id)) {
                setChatMessages((previous) => [...previous, message]);
                if (!isChatOpen) setUnreadChatCount((count) => count + 1);
            }
        }
    }

    const handleChatOpenChange = useCallback((open: boolean) => {
        setIsChatOpen(open);
        if (open) setUnreadChatCount(0);
    }, []);

    const sendChatMessage = useCallback(async (body: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(code)}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body }),
            });
            if (!response.ok) return false;
            const event = partyEventFromResponse(await response.json().catch(() => null));
            if (event?.type === "chat") {
                const message = event.message;
                setChatMessages((previous) =>
                    previous.some((existing) => existing.id === message.id) ? previous : [...previous, message]);
            }
            return true;
        } catch {
            return false;
        }
    }, [code]);

    useEffect(() => {
        const episodeKey = party.room?.currentEpisode.episodeKey;
        if (!episodeKey || episodeKey === playerProps.episodeKey) return;
        const episode = episodeKeys.find((item) => item.key === episodeKey);
        if (!episode) return;
        router.replace(partyWatchPath(seriesId, episode.number, code));
        router.refresh();
    }, [code, episodeKeys, party.room?.currentEpisode.episodeKey, playerProps.episodeKey, router, seriesId]);

    if (party.soloMode) {
        return (
            <VideoPlayer
                {...playerProps}
                startTime={recoveredStartTime ?? playerProps.startTime}
            />
        );
    }

    if (party.connectionStatus === "disconnected") {
        return (
            <div className="np-player-loading" role="alert">
                <span>Utracono połączenie z pokojem.</span>
                <div className="flex gap-3">
                    <button type="button" className="np-error-primary" onClick={party.retryConnection}>
                        Połącz ponownie
                    </button>
                    <button type="button" className="np-error-secondary" onClick={party.continueAlone}>
                        Oglądaj dalej samodzielnie
                    </button>
                </div>
            </div>
        );
    }

    if (!party.room || party.clockOffsetMs === null) {
        return (
            <div className="np-player-loading" role="status">
                <span className="np-player-loading-ring" />
                <span>Łączenie z pokojem</span>
            </div>
        );
    }

    if (party.room.closedAtMs !== null) {
        return (
            <PartyClosedScreen
                onLeave={() => {
                    router.replace(watchPath(seriesId, playerProps.episodeNumber ?? 1));
                    router.refresh();
                }}
            />
        );
    }

    if (!confirmed) {
        return (
            <PartyJoinConfirm
                code={code}
                title={playerProps.title}
                kicker={playerProps.kicker}
                subtitle={playerProps.subtitle}
                participants={party.room.participants}
                onConfirm={() => setConfirmed(true)}
            />
        );
    }

    const connectionLabel = PARTY_CONNECTION_LABEL[party.connectionStatus];

    const sync: VideoPlayerSync = {
        anchor: party.room.anchor,
        clockOffsetMs: party.clockOffsetMs,
        role: party.room.viewerRole ?? "guest",
        canControl: party.room.controlMode === "everyone" || party.room.viewerRole === "host",
        waitingForGesture,
        nextEpisodeKey,
        previousEpisodeKey,
        sendIntent: party.sendIntent,
        expectedPosition: party.expectedPosition,
        registerPlaybackAdapter,
        onWaitingForGestureChange: setWaitingForGesture,
        participants: party.room.participants,
        viewerProfileId: party.room.viewerProfileId ?? 0,
        chatMessages,
        unreadChatCount,
        onChatOpenChange: handleChatOpenChange,
        sendChatMessage,
        bufferingWait: party.room.bufferingWait ?? null,
        reportBuffering: party.reportBuffering,
        transferHost: party.transferHost,
        controlMode: party.room.controlMode,
        lastAction: party.room.lastAction ?? null,
        syncQuality: party.syncQuality,
        changeControlMode: party.changeControlMode,
    };

    return (
        <>
            {connectionLabel && (
                <p role="status" aria-live="polite" className="np-party-status-banner">
                    {connectionLabel}
                </p>
            )}
            <VideoPlayer {...playerProps} sync={sync} />
        </>
    );
};

const PartyVideoPlayer = (props: PartyVideoPlayerProps) => {
    const [joined, setJoined] = useState(false);
    const [joinFailed, setJoinFailed] = useState(false);

    useEffect(() => {
        let active = true;
        const join = async () => {
            try {
                const response = await fetch(`/api/party/${encodeURIComponent(props.code)}/join`, { method: "POST" });
                if (!response.ok) throw new Error("join");
                if (active) setJoined(true);
            } catch {
                if (active) setJoinFailed(true);
            }
        };
        void join();
        return () => { active = false; };
    }, [props.code]);

    if (joinFailed) {
        return (
            <div className="np-party-confirm" role="alert">
                <div className="np-party-confirm-panel">
                    <p className="np-party-confirm-kicker">Wspólne oglądanie</p>
                    <h1>Nie udało się dołączyć do pokoju</h1>
                    <p className="np-party-confirm-episode">
                        Sprawdź, czy link jest aktualny i czy masz dostęp do tego tytułu.
                    </p>
                </div>
            </div>
        );
    }
    if (!joined) {
        return (
            <div className="np-player-loading" role="status">
                <span className="np-player-loading-ring" />
                <span>Dołączanie do pokoju</span>
            </div>
        );
    }
    return <PartySyncedVideoPlayer {...props} />;
};

const WatchClient = ({
    playback,
    seriesTitle,
    episodeTitle,
    seasonNumber,
    episodeSynopsis,
    seriesId,
    seriesKey,
    currentEpisode,
    totalEpisodes,
    fileName,
    startTime,
    nextEpisodeTitle,
    chapters,
    autoplayNext,
    skipIntroPrompt,
    defaultVolume,
    isDemo = false,
    partyCode,
    episodeKeys,
    nextEpisodeKey,
    previousEpisodeKey,
}: WatchClientProps) => {
    const router = useRouter();
    const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
    const isNavigatingRef = useRef(false);

    useEffect(() => {
        isNavigatingRef.current = false;
    }, [fileName]);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            const isVidstackNoise = event.filename?.includes("vidstack") && (
                event.message?.includes("setAttribute") || event.message?.includes("$state[prop]")
            );
            if (isVidstackNoise) {
                event.preventDefault();
            }
        };
        window.addEventListener('error', handleGlobalError);
        return () => window.removeEventListener('error', handleGlobalError);
    }, []);

    const handleProgressUpdate = async (currentTime: number) => {
        await saveProgressAction({
            seriesKey,
            episodeKey: fileName,
            positionSeconds: currentTime,
        });
    };

    const handleNextEpisode = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        if (currentEpisode < totalEpisodes) {
            const nextEp = currentEpisode + 1;
            router.replace(watchPath(seriesId, nextEp));
        } else {
            router.replace(seriesPath(seriesId));
        }
        router.refresh();
    }

    const handlePreviousEpisode = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        router.replace(watchPath(seriesId, currentEpisode - 1));
        router.refresh();
    }

    const handleBack = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        router.push("/");
    }

    const playerProps: VideoPlayerProps = {
        playback,
        seriesKey,
        episodeKey: fileName,
        title: seriesTitle,
        kicker: `Odcinek ${currentEpisode}`,
        subtitle: episodeTitle,
        seasonNumber,
        episodeNumber: currentEpisode,
        episodeSynopsis,
        episodesLeft: Math.max(0, totalEpisodes - currentEpisode),
        nextEpisodeTitle,
        onBack: handleBack,
        onNextEpisode: handleNextEpisode,
        onPreviousEpisode: currentEpisode > 1 ? handlePreviousEpisode : undefined,
        onProgressUpdate: handleProgressUpdate,
        startTime,
        chapters,
        autoplayNext,
        skipIntroPrompt,
        defaultVolume,
    };

    return (
        <div className="fixed inset-0 z-[999] bg-[var(--nx-bg)] flex flex-col w-screen h-screen">
            <h1 className="sr-only">
                {seriesTitle} — {episodeTitle}
                {isDemo ? " (materiał demonstracyjny)" : ""}
            </h1>

            {isDemo && (
                <p
                    role="status"
                    className="pointer-events-none absolute left-1/2 top-4 z-[1001] -translate-x-1/2 rounded-full border border-white/15 bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm"
                >
                    Materiał demonstracyjny
                </p>
            )}

            <div className="flex-1 w-full h-full flex items-center justify-center">
                <PlayerErrorBoundary
                    key={playerInstanceKey}
                    onRetry={() => setPlayerInstanceKey((k) => k + 1)}
                    onBack={handleBack}
                >
                    {partyCode ? (
                        <PartyVideoPlayer
                            code={partyCode}
                            playerProps={playerProps}
                            seriesId={seriesId}
                            episodeKeys={episodeKeys}
                            nextEpisodeKey={nextEpisodeKey}
                            previousEpisodeKey={previousEpisodeKey}
                        />
                    ) : <VideoPlayer {...playerProps} />}
                </PlayerErrorBoundary>
            </div>

        </div>
    )
}

export default WatchClient;
