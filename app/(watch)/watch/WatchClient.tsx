"use client"
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import saveProgressAction from "@/lib/progress/saveProgressAction";
import PlayerErrorBoundary from "@/components/video/PlayerErrorBoundary";
import { partyWatchPath, seriesPath, watchPath } from "@/lib/core/routes";
import type { WatchPartyMessage } from "@/lib/core/contracts";
import type { WatchData } from "@/lib/player/watchData";
import { startPartyForEpisode } from "@/lib/party/startPartyForEpisode";
import {
    buildPartyFeed,
    mergeKnownNames,
    noticeForEvent,
    PARTY_NOTICE_HISTORY_LIMIT,
    type PartyKnownNames,
    type PartyNotice,
    type PartyUploadResult,
} from "@/lib/party/partyFeed";
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

type WatchClientProps = WatchData;

interface PartyVideoPlayerProps {
    code: string;
    playerProps: VideoPlayerProps;
    seriesId: number;
    episodeKeys: Array<{ key: string; number: number }>;
    nextEpisodeKey?: string;
    previousEpisodeKey?: string;
    onEpisodeChange: (episodeKey: string) => void;
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
    joining: boolean;
    onConfirm: () => void;
}

const PartyJoinConfirm = ({ code, title, kicker, subtitle, joining, onConfirm }: PartyJoinConfirmProps) => (
    <div className="np-party-confirm" role="status">
        <div className="np-party-confirm-panel">
            <p className="np-party-confirm-kicker">Watch Party</p>
            <h1>{title}</h1>
            {(kicker || subtitle) && (
                <p className="np-party-confirm-episode">{[kicker, subtitle].filter(Boolean).join(" · ")}</p>
            )}
            <p className="np-party-confirm-members">
                Nic się nie zacznie, dopóki host nie włączy odcinka. Możesz spokojnie poczekać na resztę.
            </p>
            <PartyInviteLink code={code} />
            <button type="button" className="np-party-confirm-button" onClick={onConfirm} disabled={joining}>
                {joining ? "Dołączanie…" : "Dołącz do pokoju"}
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

const TYPING_INDICATOR_TTL_MS = 4000;

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
    onEpisodeChange,
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
    const [recoveredStartTime, setRecoveredStartTime] = useState<number | null>(null);
    const [startingParty, setStartingParty] = useState(false);
    const [typingSeenAtMs, setTypingSeenAtMs] = useState<Record<number, number>>({});

    useEffect(() => {
        if (Object.keys(typingSeenAtMs).length === 0) return;
        const interval = setInterval(() => {
            setTypingSeenAtMs((previous) => {
                const now = Date.now();
                const next = Object.fromEntries(
                    Object.entries(previous).filter(([, seenAtMs]) => now - seenAtMs < TYPING_INDICATOR_TTL_MS),
                );
                return Object.keys(next).length === Object.keys(previous).length ? previous : next;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [typingSeenAtMs]);

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
    const [notices, setNotices] = useState<PartyNotice[]>([]);
    const [knownNames, setKnownNames] = useState<PartyKnownNames>({});

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
            const authorId = message.profileId;
            setTypingSeenAtMs((previous) => {
                if (previous[authorId] === undefined) return previous;
                const next = { ...previous };
                delete next[authorId];
                return next;
            });
        }
        if (party.lastEvent.type === "typing") {
            const { profileId } = party.lastEvent;
            setTypingSeenAtMs((previous) => ({ ...previous, [profileId]: Date.now() }));
        }
        const notice = noticeForEvent(party.lastEvent, knownNames);
        if (notice !== null) {
            setNotices((previous) => previous.some((entry) => entry.id === notice.id)
                ? previous
                : [...previous, notice].slice(-PARTY_NOTICE_HISTORY_LIMIT));
        }
    }

    const currentParticipants = party.room?.participants;
    if (currentParticipants !== undefined) {
        const mergedNames = mergeKnownNames(knownNames, currentParticipants);
        if (mergedNames !== knownNames) setKnownNames(mergedNames);
    }

    const typingProfileIds = Object.keys(typingSeenAtMs).map(Number);
    const chatFeed = buildPartyFeed(chatMessages, notices);

    const handleChatOpenChange = useCallback((open: boolean) => {
        setIsChatOpen(open);
        if (open) setUnreadChatCount(0);
    }, []);

    const sendChatMessage = useCallback(async (body: string, attachmentUrl: string | null): Promise<boolean> => {
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(code)}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body, attachment: attachmentUrl }),
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

    const uploadChatImage = useCallback(async (file: File): Promise<PartyUploadResult> => {
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(code)}/attachment`, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });
            const payload = await response.json().catch(() => null) as {
                attachment?: unknown;
                error?: unknown;
            } | null;

            if (!response.ok) {
                return {
                    ok: false,
                    message: typeof payload?.error === "string"
                        ? payload.error
                        : `Serwer odrzucił obraz (błąd ${response.status}).`,
                };
            }
            if (typeof payload?.attachment !== "string") {
                return { ok: false, message: "Serwer nie zwrócił adresu obrazu." };
            }
            return { ok: true, storageKey: payload.attachment };
        } catch {
            return { ok: false, message: "Brak połączenia z serwerem." };
        }
    }, [code]);

    useEffect(() => {
        const episodeKey = party.room?.currentEpisode.episodeKey;
        if (!episodeKey || episodeKey === playerProps.episodeKey) return;
        const episode = episodeKeys.find((item) => item.key === episodeKey);
        if (!episode) return;
        onEpisodeChange(episode.key);
    }, [episodeKeys, onEpisodeChange, party.room?.currentEpisode.episodeKey, playerProps.episodeKey]);

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
                }}
            />
        );
    }

    const connectionLabel = PARTY_CONNECTION_LABEL[party.connectionStatus];
    const handleStartParty = () => {
        setStartingParty(true);
        void party.sendIntent({ kind: "play" }).finally(() => setStartingParty(false));
    };

    const sync: VideoPlayerSync = {
        roomCode: code,
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
        chatFeed,
        unreadChatCount,
        typingProfileIds,
        partyStarted: party.room.anchor.anchorVersion > 0,
        starting: startingParty,
        onStartParty: handleStartParty,
        onChatOpenChange: handleChatOpenChange,
        sendChatMessage,
        uploadChatImage,
        sendTyping: () => void party.sendTyping(),
        bufferingWait: party.room.bufferingWait ?? null,
        reportBuffering: party.reportBuffering,
        transferHost: party.transferHost,
        controlMode: party.room.controlMode,
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
    const [joining, setJoining] = useState(false);
    const [joinFailed, setJoinFailed] = useState(false);

    const join = async () => {
        setJoining(true);
        setJoinFailed(false);
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(props.code)}/join`, { method: "POST" });
            if (!response.ok) throw new Error("join");
            setJoined(true);
        } catch {
            setJoinFailed(true);
        } finally {
            setJoining(false);
        }
    };

    if (joinFailed) {
        return (
            <div className="np-party-confirm" role="alert">
                <div className="np-party-confirm-panel">
                    <p className="np-party-confirm-kicker">Watch Party</p>
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
            <PartyJoinConfirm
                code={props.code}
                title={props.playerProps.title}
                kicker={props.playerProps.kicker}
                subtitle={props.playerProps.subtitle}
                joining={joining}
                onConfirm={() => void join()}
            />
        );
    }
    return <PartySyncedVideoPlayer {...props} />;
};

const WatchClient = (initialData: WatchClientProps) => {
    const [data, setData] = useState(initialData);
    const [previousInitialData, setPreviousInitialData] = useState(initialData);
    if (initialData.seriesKey !== previousInitialData.seriesKey
        || initialData.fileName !== previousInitialData.fileName
        || initialData.playback.src !== previousInitialData.playback.src
        || initialData.startTime !== previousInitialData.startTime
        || initialData.partyCode !== previousInitialData.partyCode) {
        setPreviousInitialData(initialData);
        setData(initialData);
    }
    const {
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
        trackProgress = true,
        partyCode,
        episodeKeys,
        nextEpisodeKey,
        previousEpisodeKey,
    } = data;
    const router = useRouter();
    const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
    const [partyStartError, setPartyStartError] = useState<string | null>(null);
    const isNavigatingRef = useRef(false);
    const episodeRequestRef = useRef<AbortController | null>(null);
    const requestedEpisodeRef = useRef<string | null>(null);
    const [episodeLoading, setEpisodeLoading] = useState(false);
    const [episodeError, setEpisodeError] = useState<string | null>(null);

    useEffect(() => () => {
        const request = episodeRequestRef.current;
        episodeRequestRef.current = null;
        request?.abort();
        isNavigatingRef.current = false;
    }, [initialData.seriesKey, initialData.fileName, initialData.playback.src, initialData.partyCode]);

    const changeEpisode = useCallback(async (episodeKey: string) => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;
        requestedEpisodeRef.current = episodeKey;
        const controller = new AbortController();
        episodeRequestRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        setEpisodeLoading(true);
        setEpisodeError(null);
        try {
            const params = new URLSearchParams({ id: String(seriesId), ep: episodeKey });
            const response = await fetch(`/api/watch?${params}`, {
                cache: "no-store",
                signal: controller.signal,
            });
            if (!response.ok) throw new Error("episode-load-failed");
            const next: WatchData = await response.json();
            if (controller.signal.aborted) return;
            setData({ ...next, partyCode, trackProgress });
            // Keep the player mounted and update the address without an RSC navigation.
            window.history.replaceState(null, "", partyCode
                ? partyWatchPath(next.seriesId, next.fileName, partyCode)
                : watchPath(next.seriesId, next.fileName));
        } catch {
            if (episodeRequestRef.current === controller) {
                setEpisodeError("Nie udało się wczytać odcinka. Spróbuj ponownie.");
            }
        } finally {
            window.clearTimeout(timeout);
            if (episodeRequestRef.current === controller) {
                episodeRequestRef.current = null;
                isNavigatingRef.current = false;
                setEpisodeLoading(false);
            }
        }
    }, [partyCode, seriesId, trackProgress]);

    useEffect(() => {
        isNavigatingRef.current = false;
    }, [fileName, partyCode]);

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
        if (!trackProgress) return;

        await saveProgressAction({
            seriesKey,
            episodeKey: fileName,
            positionSeconds: currentTime,
        });
    };

    const handleNextEpisode = () => {
        if (nextEpisodeKey) {
            void changeEpisode(nextEpisodeKey);
        } else {
            if (isNavigatingRef.current) return;
            isNavigatingRef.current = true;
            router.replace(seriesPath(seriesId));
        }
    }

    const handlePreviousEpisode = () => {
        if (previousEpisodeKey) void changeEpisode(previousEpisodeKey);
    }

    const handleBack = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        router.push("/");
    }

    const handleStartParty = async (positionSeconds: number) => {
        if (isNavigatingRef.current) return;
        const result = await startPartyForEpisode(seriesKey, fileName, positionSeconds);
        if (!result.ok || !result.code) {
            setPartyStartError(result.error ?? "Nie udało się utworzyć pokoju.");
            window.setTimeout(() => setPartyStartError(null), 4000);
            return;
        }
        isNavigatingRef.current = true;
        router.replace(partyWatchPath(seriesId, currentEpisode, result.code));
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
        onPreviousEpisode: previousEpisodeKey ? handlePreviousEpisode : undefined,
        onProgressUpdate: handleProgressUpdate,
        startTime,
        chapters,
        autoplayNext,
        skipIntroPrompt,
        defaultVolume,
        onStartParty: partyCode ? undefined : (positionSeconds: number) => void handleStartParty(positionSeconds),
    };

    return (
        <div className="np-watch-screen">
            <h1 className="sr-only">
                {seriesTitle} — {episodeTitle}
                {isDemo ? " (materiał demonstracyjny)" : ""}
            </h1>

            {partyStartError && (
                <p
                    role="alert"
                    className="np-watch-toast np-watch-toast--error"
                >
                    {partyStartError}
                </p>
            )}

            {(episodeLoading || episodeError) && (
                <div role={episodeError ? "alert" : "status"} className="np-watch-toast">
                    {episodeError ?? "Ładowanie odcinka…"}
                    {episodeError && (
                        <button type="button" className="np-error-secondary" onClick={() => {
                            if (requestedEpisodeRef.current) void changeEpisode(requestedEpisodeRef.current);
                        }}>
                            Spróbuj ponownie
                        </button>
                    )}
                </div>
            )}

            {isDemo && (
                <aside
                    aria-label="Autor i licencja materiału demonstracyjnego"
                    className="np-watch-toast np-watch-toast--demo"
                >
                    <span>Sprite Fright</span>
                    <span aria-hidden="true">·</span>
                    <a
                        href="https://studio.blender.org/projects/sprite-fright/pages/about/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="np-watch-demo-attribution-link"
                    >
                        (CC) Blender Foundation
                    </a>
                    <span aria-hidden="true">·</span>
                    <a
                        href="https://creativecommons.org/licenses/by/1.0/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="np-watch-demo-attribution-link"
                    >
                        CC BY 1.0
                    </a>
                </aside>
            )}

            <div className="np-watch-player-slot">
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
                            onEpisodeChange={changeEpisode}
                        />
                    ) : <VideoPlayer {...playerProps} />}
                </PlayerErrorBoundary>
            </div>

        </div>
    )
}

export default WatchClient;
