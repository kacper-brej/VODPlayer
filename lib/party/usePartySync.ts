"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WatchPartyCommand, WatchPartyRoomState, WatchPartyState } from "@/lib/core/contracts";
import { estimateClockOffset, type ClockSample } from "@/lib/party/clockSync";
import { decideDriftCorrection, type DriftCorrectionDecision } from "@/lib/party/driftCorrection";
import {
    applyPartyEventToRoom,
    initialPartyEventCursor,
    isPartyControlEvent,
    parsePartyEventMessage,
    partyEventFromResponse,
    partyRoomFromResponse,
    PARTY_EVENT_TYPES,
    type PartyControlEvent,
    type PartyEvent,
    type PartyEventCursor,
} from "@/lib/party/partyEvents";
import { PARTY_HEARTBEAT_INTERVAL_MS, partyReconnectDelay, recoveredPartyPosition } from "@/lib/party/partyRecovery";

const CLOCK_SAMPLE_COUNT = 7;
const CLOCK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const CORRECTION_INTERVAL_MS = 1000;
const CHANNEL_RENEWAL_MARGIN_MS = 60_000;
const TELEMETRY_FLUSH_INTERVAL_MS = 60_000;

export interface PartyPlaybackSnapshot {
    positionSeconds: number;
    state: WatchPartyState;
    playbackRate: number;
}

export interface UsePartySyncOptions {
    readPlayback?: () => PartyPlaybackSnapshot | null;
    onCorrection?: (decision: DriftCorrectionDecision) => void;
    correctionIntervalMs?: number;
}

export type PartyConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
export type PartySyncQuality = "synchronized" | "correcting" | "out-of-sync";

interface ChannelGrant {
    streamUrl: string;
    expiresAtMs: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readUnknownJson = async (response: Response): Promise<unknown> =>
    response.json().catch(() => null) as Promise<unknown>;

const readServerTime = (value: unknown): number | null =>
    isObject(value) && typeof value.serverNowMs === "number" && Number.isFinite(value.serverNowMs)
        ? value.serverNowMs
        : null;

const readChannelGrant = (value: unknown): ChannelGrant | null =>
    isObject(value)
    && typeof value.streamUrl === "string"
    && value.streamUrl.startsWith("https://")
    && typeof value.expiresAtMs === "number"
    && Number.isFinite(value.expiresAtMs)
        ? { streamUrl: value.streamUrl, expiresAtMs: value.expiresAtMs }
        : null;

export const usePartySync = (code: string, options: UsePartySyncOptions = {}) => {
    const [room, setRoom] = useState<WatchPartyRoomState | null>(null);
    const [clockOffsetMs, setClockOffsetMs] = useState<number | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<PartyConnectionStatus>("connecting");
    const [lastEvent, setLastEvent] = useState<PartyEvent | null>(null);
    const [pendingCommand, setPendingCommand] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const [soloMode, setSoloMode] = useState(false);
    const [syncQuality, setSyncQuality] = useState<PartySyncQuality>("out-of-sync");

    const roomRef = useRef<WatchPartyRoomState | null>(null);
    const cursorRef = useRef<PartyEventCursor | null>(null);
    const offsetRef = useRef<number | null>(null);
    const readPlaybackRef = useRef(options.readPlayback);
    const onCorrectionRef = useRef(options.onCorrection);
    const pendingCommandRef = useRef(false);
    const telemetryRef = useRef({
        sessionId: "",
        joinedAtMs: 0,
        driftBuckets: [0, 0, 0, 0, 0] as [number, number, number, number, number],
        hardSeeks: 0,
        timeToSyncMs: null as number | null,
        dirty: false,
    });

    useEffect(() => {
        readPlaybackRef.current = options.readPlayback;
        onCorrectionRef.current = options.onCorrection;
    }, [options.onCorrection, options.readPlayback]);

    const installRoom = useCallback((nextRoom: WatchPartyRoomState) => {
        roomRef.current = nextRoom;
        cursorRef.current = initialPartyEventCursor(nextRoom);
        setRoom(nextRoom);
    }, []);

    const resync = useCallback(async (): Promise<boolean> => {
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(code)}`, { cache: "no-store" });
            if (!response.ok) throw new Error("state");
            const nextRoom = partyRoomFromResponse(await readUnknownJson(response));
            if (nextRoom === null) throw new Error("state");
            installRoom(nextRoom);
            setError(null);
            return true;
        } catch {
            setError("Nie udało się odtworzyć stanu pokoju.");
            return false;
        }
    }, [code, installRoom]);

    const synchronizeClock = useCallback(async (): Promise<boolean> => {
        const samples: ClockSample[] = [];
        for (let index = 0; index < CLOCK_SAMPLE_COUNT; index += 1) {
            const clientSentAtMs = Date.now();
            try {
                const response = await fetch("/api/party/time", { cache: "no-store" });
                const clientReceivedAtMs = Date.now();
                if (!response.ok) continue;
                const serverNowMs = readServerTime(await readUnknownJson(response));
                if (serverNowMs === null) continue;
                samples.push({ clientSentAtMs, serverNowMs, clientReceivedAtMs });
            } catch {
            }
        }

        const estimate = estimateClockOffset(samples);
        if (estimate === null) {
            setError("Nie udało się zsynchronizować zegara pokoju.");
            return false;
        }
        offsetRef.current = estimate.offsetMs;
        setClockOffsetMs(estimate.offsetMs);
        return true;
    }, []);

    const applyEvent = useCallback((event: PartyEvent): boolean => {
        const currentRoom = roomRef.current;
        if (currentRoom === null) return false;
        const currentCursor = cursorRef.current ?? initialPartyEventCursor(currentRoom);
        const result = applyPartyEventToRoom(currentRoom, event, currentCursor);
        if (!result.applied) return false;
        roomRef.current = result.room;
        cursorRef.current = result.cursor;
        setRoom(result.room);
        setLastEvent(event);
        return true;
    }, []);

    const expectedPosition = useCallback((clientNowMs = Date.now()): number | null => {
        const currentRoom = roomRef.current;
        const offset = offsetRef.current;
        if (currentRoom === null || offset === null) return null;
        return recoveredPartyPosition(currentRoom, offset, clientNowMs);
    }, []);

    const correctionFor = useCallback((playback: PartyPlaybackSnapshot): DriftCorrectionDecision => {
        const expected = expectedPosition();
        if (expected === null) return { kind: "none" };
        const absoluteDrift = Math.abs(expected - playback.positionSeconds);
        const telemetry = telemetryRef.current;
        const bucket = absoluteDrift < 0.25 ? 0 : absoluteDrift < 0.5 ? 1 : absoluteDrift < 1 ? 2 : absoluteDrift <= 2 ? 3 : 4;
        telemetry.driftBuckets[bucket] += 1;
        telemetry.dirty = true;
        if (bucket === 0 && telemetry.timeToSyncMs === null && telemetry.joinedAtMs > 0) {
            telemetry.timeToSyncMs = Date.now() - telemetry.joinedAtMs;
        }
        setSyncQuality(absoluteDrift < 0.25 ? "synchronized" : absoluteDrift <= 2 ? "correcting" : "out-of-sync");
        const decision = decideDriftCorrection({
            expectedPositionSeconds: expected,
            actualPositionSeconds: playback.positionSeconds,
            playbackState: roomRef.current?.anchor.state ?? playback.state,
            currentPlaybackRate: playback.playbackRate,
        });
        if (decision.kind === "seek") telemetry.hardSeeks += 1;
        return decision;
    }, [expectedPosition]);

    const sendIntent = useCallback(async (command: WatchPartyCommand): Promise<PartyControlEvent | null> => {
        if (soloMode) return null;
        const currentRoom = roomRef.current;
        if (currentRoom === null || pendingCommandRef.current) return null;
        pendingCommandRef.current = true;
        setPendingCommand(true);
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(code)}/command`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command, expectedVersion: currentRoom.anchor.anchorVersion }),
            });
            if (!response.ok) {
                if (response.status === 409) await resync();
                throw new Error("command");
            }
            const payload = await readUnknownJson(response);
            const event = partyEventFromResponse(payload);
            if (event === null) {
                const freshRoom = partyRoomFromResponse(payload);
                if (freshRoom !== null) {
                    installRoom(freshRoom);
                    setError(null);
                    return null;
                }
                throw new Error("command");
            }
            if (!isPartyControlEvent(event)) throw new Error("command");
            applyEvent(event);
            setError(null);
            return event;
        } catch {
            setError("Nie udało się zatwierdzić komendy pokoju.");
            return null;
        } finally {
            pendingCommandRef.current = false;
            setPendingCommand(false);
        }
    }, [applyEvent, code, installRoom, resync, soloMode]);

    const postCoordination = useCallback(async (
        endpoint: "buffering" | "host" | "control-mode",
        body: Record<string, unknown>,
    ): Promise<boolean> => {
        if (soloMode || roomRef.current === null) return false;
        try {
            const response = await fetch(`/api/party/${encodeURIComponent(code)}/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                if (response.status === 409) await resync();
                return false;
            }
            const event = partyEventFromResponse(await readUnknownJson(response));
            if (event === null) return false;
            applyEvent(event);
            setError(null);
            return true;
        } catch {
            return false;
        }
    }, [applyEvent, code, resync, soloMode]);

    const reportBuffering = useCallback((buffering: boolean): Promise<boolean> =>
        postCoordination("buffering", { buffering }), [postCoordination]);

    const transferHost = useCallback((targetProfileId: number): Promise<boolean> =>
        postCoordination("host", { targetProfileId }), [postCoordination]);

    const changeControlMode = useCallback((controlMode: "host" | "everyone"): Promise<boolean> =>
        postCoordination("control-mode", { controlMode }), [postCoordination]);

    const retryConnection = useCallback(() => {
        setSoloMode(false);
        setError(null);
        setConnectionStatus("connecting");
        setRetryNonce((value) => value + 1);
    }, []);

    const continueAlone = useCallback(() => {
        setSoloMode(true);
        setConnectionStatus("disconnected");
        setError(null);
    }, []);

    useEffect(() => {
        if (soloMode) return;
        let active = true;
        const initialSync = setTimeout(() => {
            if (!active) return;
            void resync();
            void synchronizeClock();
        }, 0);
        const interval = setInterval(() => {
            if (active) void synchronizeClock();
        }, CLOCK_REFRESH_INTERVAL_MS);
        return () => {
            active = false;
            clearTimeout(initialSync);
            clearInterval(interval);
        };
    }, [resync, soloMode, synchronizeClock]);

    useEffect(() => {
        if (soloMode) return;
        let active = true;
        let source: EventSource | null = null;
        let renewal: ReturnType<typeof setTimeout> | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let reconnectAttempt = 0;
        let connecting = false;

        const scheduleReconnect = () => {
            if (!active || reconnectTimer !== null) return;
            source?.close();
            source = null;
            if (renewal) clearTimeout(renewal);
            renewal = null;
            const delay = partyReconnectDelay(reconnectAttempt);
            if (delay === null) {
                setConnectionStatus("disconnected");
                setError("Utracono połączenie z pokojem.");
                return;
            }
            reconnectAttempt += 1;
            setConnectionStatus("reconnecting");
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                void connect();
            }, delay);
        };

        const connect = async () => {
            if (!active || connecting) return;
            connecting = true;
            try {
                const response = await fetch(`/api/party/${encodeURIComponent(code)}/channel-token`, { method: "POST" });
                if (!response.ok) throw new Error("channel");
                const grant = readChannelGrant(await readUnknownJson(response));
                if (grant === null) throw new Error("channel");

                source?.close();
                source = new EventSource(grant.streamUrl);
                const handleMessage = (message: MessageEvent<string>) => {
                    const event = parsePartyEventMessage(message.data);
                    if (event !== null) applyEvent(event);
                };
                source.onmessage = handleMessage;
                for (const eventType of PARTY_EVENT_TYPES) {
                    source.addEventListener(eventType, handleMessage as EventListener);
                }
                source.onopen = () => {
                    if (!active) return;
                    void resync().then((recovered) => {
                        if (!active) return;
                        if (!recovered) {
                            scheduleReconnect();
                            return;
                        }
                        reconnectAttempt = 0;
                        setConnectionStatus("connected");
                        setError(null);
                    });
                };
                source.onerror = () => {
                    scheduleReconnect();
                };

                const renewalDelay = Math.max(30_000, grant.expiresAtMs - Date.now() - CHANNEL_RENEWAL_MARGIN_MS);
                renewal = setTimeout(() => {
                    source?.close();
                    source = null;
                    reconnectAttempt = 0;
                    scheduleReconnect();
                }, renewalDelay);
            } catch {
                scheduleReconnect();
            } finally {
                connecting = false;
            }
        };

        scheduleReconnect();
        return () => {
            active = false;
            if (renewal) clearTimeout(renewal);
            if (reconnectTimer) clearTimeout(reconnectTimer);
            source?.close();
        };
    }, [applyEvent, code, resync, retryNonce, soloMode]);

    const joinedRoomCode = room?.code;

    useEffect(() => {
        if (joinedRoomCode === undefined || soloMode) return;
        const telemetry = telemetryRef.current;
        if (telemetry.sessionId === "") {
            telemetry.sessionId = crypto.randomUUID();
            telemetry.joinedAtMs = Date.now();
        }
        const flush = () => {
            if (!telemetry.dirty || telemetry.sessionId === "") return;
            telemetry.dirty = false;
            void fetch(`/api/party/${encodeURIComponent(code)}/telemetry`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: telemetry.sessionId,
                    driftBuckets: telemetry.driftBuckets,
                    hardSeeks: telemetry.hardSeeks,
                    timeToSyncMs: telemetry.timeToSyncMs,
                }),
                keepalive: true,
            }).catch(() => { telemetry.dirty = true; });
        };
        const interval = setInterval(flush, TELEMETRY_FLUSH_INTERVAL_MS);
        window.addEventListener("pagehide", flush);
        return () => {
            clearInterval(interval);
            window.removeEventListener("pagehide", flush);
            flush();
        };
    }, [code, joinedRoomCode, soloMode]);

    useEffect(() => {
        const timeoutAtMs = room?.bufferingWait?.timeoutAtMs;
        if (soloMode || timeoutAtMs === undefined) return;
        const delay = Math.max(0, timeoutAtMs - ((offsetRef.current ?? 0) + Date.now()));
        const timeout = setTimeout(() => {
            void postCoordination("buffering", { reconcile: true });
        }, delay + 25);
        return () => clearTimeout(timeout);
    }, [postCoordination, room?.bufferingWait?.timeoutAtMs, soloMode]);

    useEffect(() => {
        if (soloMode || joinedRoomCode === undefined) return;
        const heartbeat = async () => {
            try {
                await fetch(`/api/party/${encodeURIComponent(code)}/heartbeat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                });
            } catch {
            }
        };
        void heartbeat();
        const interval = setInterval(() => void heartbeat(), PARTY_HEARTBEAT_INTERVAL_MS);
        return () => {
            clearInterval(interval);
        };
    }, [code, joinedRoomCode, soloMode]);

    useEffect(() => {
        if (soloMode) return;
        const intervalMs = Math.max(250, options.correctionIntervalMs ?? CORRECTION_INTERVAL_MS);
        const interval = setInterval(() => {
            const playback = readPlaybackRef.current?.();
            const applyCorrection = onCorrectionRef.current;
            if (playback === null || playback === undefined || applyCorrection === undefined) return;
            applyCorrection(correctionFor(playback));
        }, intervalMs);
        return () => clearInterval(interval);
    }, [correctionFor, options.correctionIntervalMs, soloMode]);

    return {
        room,
        clockOffsetMs,
        connectionStatus,
        lastEvent,
        pendingCommand,
        error,
        resync,
        sendIntent,
        reportBuffering,
        transferHost,
        changeControlMode,
        expectedPosition,
        correctionFor,
        retryConnection,
        continueAlone,
        soloMode,
        syncQuality,
    };
};
