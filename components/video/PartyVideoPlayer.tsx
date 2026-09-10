"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { watchPath } from "@/lib/core/routes";
import type { WatchPartyMessage } from "@/lib/core/contracts";
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
import type { VideoPlayerProps, VideoPlayerSync } from "./VideoPlayer";
import VideoPlayer from "./LazyVideoPlayer";

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

    const typingProfileIds = useMemo(() => Object.keys(typingSeenAtMs).map(Number), [typingSeenAtMs]);
    const chatFeed = useMemo(() => buildPartyFeed(chatMessages, notices), [chatMessages, notices]);

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

    const sendPartyTyping = party.sendTyping;
    const sendTyping = useCallback(() => { void sendPartyTyping(); }, [sendPartyTyping]);

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
        sendTyping,
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

export default PartyVideoPlayer;
