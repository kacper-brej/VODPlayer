import type {
    WatchPartyAnchor,
    WatchPartyMember,
    WatchPartyMessage,
    WatchPartyRoomState,
    WatchPartyBufferingWait,
} from "@/lib/core/contracts";
import { normalizePartyAttachment } from "@/lib/party/partyAttachment";

export type PartyControlEventType = "play" | "pause" | "seek" | "episode-change";

export const PARTY_EVENT_TYPES = [
    "play",
    "pause",
    "seek",
    "episode-change",
    "member-joined",
    "member-left",
    "party-closed",
    "chat",
    "heartbeat",
    "buffering",
    "host-changed",
    "control-mode",
    "typing",
] as const;

export interface PartyControlEvent {
    type: PartyControlEventType;
    roomCode: string;
    eventAtMs: number;
    anchor: WatchPartyAnchor;
    episodeKey: string;
    actorProfileId: number;
}

export interface PartyControlModeEvent {
    type: "control-mode";
    roomCode: string;
    eventAtMs: number;
    actorProfileId: number;
    controlMode: "host" | "everyone";
}

export interface PartyMemberJoinedEvent {
    type: "member-joined";
    roomCode: string;
    eventAtMs: number;
    participants: WatchPartyMember[];
}

export interface PartyMemberLeftEvent {
    type: "member-left";
    roomCode: string;
    eventAtMs: number;
    profileId: number;
    participants: WatchPartyMember[];
}

export interface PartyClosedEvent {
    type: "party-closed";
    roomCode: string;
    eventAtMs: number;
    closedAtMs: number;
    participants: WatchPartyMember[];
}

export interface PartyChatEvent {
    type: "chat";
    roomCode: string;
    eventAtMs: number;
    message: WatchPartyMessage;
}

export interface PartyHeartbeatEvent {
    type: "heartbeat";
    roomCode: string;
    eventAtMs: number;
    profileId: number;
    lastSeenAtMs: number;
}

export interface PartyBufferingEvent {
    type: "buffering";
    roomCode: string;
    eventAtMs: number;
    anchor: WatchPartyAnchor;
    bufferingWait: WatchPartyBufferingWait | null;
    participants: WatchPartyMember[];
}

export interface PartyTypingEvent {
    type: "typing";
    roomCode: string;
    eventAtMs: number;
    profileId: number;
}

export interface PartyHostChangedEvent {
    type: "host-changed";
    roomCode: string;
    eventAtMs: number;
    hostProfileId: number;
    participants: WatchPartyMember[];
}

export type PartyEvent =
    | PartyControlEvent
    | PartyMemberJoinedEvent
    | PartyMemberLeftEvent
    | PartyClosedEvent
    | PartyChatEvent
    | PartyHeartbeatEvent
    | PartyBufferingEvent
    | PartyHostChangedEvent
    | PartyControlModeEvent
    | PartyTypingEvent;

export const isPartyControlEvent = (event: PartyEvent): event is PartyControlEvent =>
    event.type === "play"
    || event.type === "pause"
    || event.type === "seek"
    || event.type === "episode-change";

export interface PartyEventCursor {
    compositionEventAtMs: number;
    lastChatMessageId: number;
}

export interface AppliedPartyEvent {
    room: WatchPartyRoomState;
    cursor: PartyEventCursor;
    applied: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);
const isSafePositiveInteger = (value: unknown): value is number =>
    isFiniteNumber(value) && Number.isSafeInteger(value) && value > 0;
const isSafeNonNegativeInteger = (value: unknown): value is number =>
    isFiniteNumber(value) && Number.isSafeInteger(value) && value >= 0;
const isString = (value: unknown): value is string => typeof value === "string";

const isAnchor = (value: unknown): value is WatchPartyAnchor =>
    isObject(value)
    && (value.state === "playing" || value.state === "paused")
    && isFiniteNumber(value.positionSeconds)
    && value.positionSeconds >= 0
    && isFiniteNumber(value.anchorAtMs)
    && isSafeNonNegativeInteger(value.anchorVersion);

const isMember = (value: unknown): value is WatchPartyMember =>
    isObject(value)
    && isSafePositiveInteger(value.profileId)
    && isString(value.name)
    && (value.avatar === null || isString(value.avatar))
    && (value.role === "host" || value.role === "guest")
    && isFiniteNumber(value.joinedAtMs)
    && isFiniteNumber(value.lastSeenAtMs)
    && typeof value.isBuffering === "boolean";

const isMembers = (value: unknown): value is WatchPartyMember[] =>
    Array.isArray(value) && value.every(isMember);

const isBufferingWait = (value: unknown): value is WatchPartyBufferingWait =>
    isObject(value)
    && isSafePositiveInteger(value.profileId)
    && isFiniteNumber(value.startedAtMs)
    && isFiniteNumber(value.timeoutAtMs)
    && value.timeoutAtMs >= value.startedAtMs;

const isAttachmentUrl = (value: unknown): boolean =>
    value === undefined || value === null || normalizePartyAttachment(value) !== null;

const isAttachmentKind = (value: unknown): boolean =>
    value === undefined || value === null || value === "image" || value === "gif";

const isMessage = (value: unknown): value is WatchPartyMessage =>
    isObject(value)
    && isSafePositiveInteger(value.id)
    && isSafePositiveInteger(value.profileId)
    && isString(value.body)
    && isFiniteNumber(value.createdAtMs)
    && (value.authorName === undefined || isString(value.authorName))
    && (value.authorAvatar === undefined || value.authorAvatar === null || isString(value.authorAvatar))
    && isAttachmentUrl(value.attachmentUrl)
    && isAttachmentKind(value.attachmentKind);

export const validatePartyRoomState = (value: unknown): WatchPartyRoomState | null => {
    if (!isObject(value) || !isObject(value.currentEpisode)) return null;
    if (!isString(value.code) || value.code === "" || !isSafePositiveInteger(value.hostProfileId)) return null;
    if (value.viewerRole !== undefined && value.viewerRole !== "host" && value.viewerRole !== "guest") return null;
    if (value.viewerProfileId !== undefined && !isSafePositiveInteger(value.viewerProfileId)) return null;
    if (!isString(value.currentEpisode.seriesKey) || !isString(value.currentEpisode.episodeKey)) return null;
    if (value.controlMode !== "host" && value.controlMode !== "everyone") return null;
    if (!isAnchor(value.anchor) || !isMembers(value.participants)) return null;
    if (value.bufferingWait !== undefined && value.bufferingWait !== null && !isBufferingWait(value.bufferingWait)) return null;
    if (!isFiniteNumber(value.serverNowMs) || !isFiniteNumber(value.expiresAtMs)) return null;
    if (value.closedAtMs !== null && !isFiniteNumber(value.closedAtMs)) return null;
    return value as unknown as WatchPartyRoomState;
};

export const partyRoomFromResponse = (value: unknown): WatchPartyRoomState | null =>
    isObject(value) ? validatePartyRoomState(value.room) : null;

export const partyEventFromResponse = (value: unknown): PartyEvent | null =>
    isObject(value) ? validatePartyEvent(value.event) : null;

const hasEventBase = (value: Record<string, unknown>): boolean =>
    isString(value.roomCode) && value.roomCode !== "" && isFiniteNumber(value.eventAtMs);

export const validatePartyEvent = (value: unknown): PartyEvent | null => {
    if (!isObject(value) || !hasEventBase(value) || !isString(value.type)) return null;

    switch (value.type) {
        case "play":
        case "pause":
        case "seek":
        case "episode-change":
            return isAnchor(value.anchor) && isString(value.episodeKey) && value.episodeKey !== ""
                && isSafePositiveInteger(value.actorProfileId)
                ? value as unknown as PartyControlEvent
                : null;
        case "member-joined":
            return isMembers(value.participants) ? value as unknown as PartyMemberJoinedEvent : null;
        case "member-left":
            return isSafePositiveInteger(value.profileId) && isMembers(value.participants)
                ? value as unknown as PartyMemberLeftEvent
                : null;
        case "party-closed":
            return isFiniteNumber(value.closedAtMs) && isMembers(value.participants)
                ? value as unknown as PartyClosedEvent
                : null;
        case "chat":
            return isMessage(value.message) ? value as unknown as PartyChatEvent : null;
        case "heartbeat":
            return isSafePositiveInteger(value.profileId) && isFiniteNumber(value.lastSeenAtMs)
                ? value as unknown as PartyHeartbeatEvent
                : null;
        case "buffering":
            return isAnchor(value.anchor)
                && (value.bufferingWait === null || isBufferingWait(value.bufferingWait))
                && isMembers(value.participants)
                ? value as unknown as PartyBufferingEvent
                : null;
        case "host-changed":
            return isSafePositiveInteger(value.hostProfileId) && isMembers(value.participants)
                ? value as unknown as PartyHostChangedEvent
                : null;
        case "control-mode":
            return isSafePositiveInteger(value.actorProfileId)
                && (value.controlMode === "host" || value.controlMode === "everyone")
                ? value as unknown as PartyControlModeEvent
                : null;
        case "typing":
            return isSafePositiveInteger(value.profileId) ? value as unknown as PartyTypingEvent : null;
        default:
            return null;
    }
};

export const parsePartyEventMessage = (raw: string): PartyEvent | null => {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (isObject(parsed) && "data" in parsed) {
            const data = typeof parsed.data === "string" ? JSON.parse(parsed.data) as unknown : parsed.data;
            return validatePartyEvent(data);
        }
        return validatePartyEvent(parsed);
    } catch {
        return null;
    }
};

export const initialPartyEventCursor = (room: WatchPartyRoomState): PartyEventCursor => ({
    compositionEventAtMs: room.serverNowMs,
    lastChatMessageId: 0,
});

export const applyPartyEventToRoom = (
    room: WatchPartyRoomState,
    event: PartyEvent,
    cursor: PartyEventCursor = initialPartyEventCursor(room),
): AppliedPartyEvent => {
    if (event.roomCode !== room.code) return { room, cursor, applied: false };

    switch (event.type) {
        case "play":
        case "pause":
        case "seek":
        case "episode-change":
            if (event.anchor.anchorVersion <= room.anchor.anchorVersion) return { room, cursor, applied: false };
            return {
                room: {
                    ...room,
                    currentEpisode: { ...room.currentEpisode, episodeKey: event.episodeKey },
                    anchor: event.anchor,
                    lastAction: {
                        profileId: event.actorProfileId,
                        kind: event.type,
                        atMs: event.eventAtMs,
                    },
                    serverNowMs: Math.max(room.serverNowMs, event.eventAtMs),
                },
                cursor,
                applied: true,
            };
        case "member-joined":
        case "member-left":
            if (event.eventAtMs <= cursor.compositionEventAtMs) return { room, cursor, applied: false };
            return {
                room: { ...room, participants: event.participants, serverNowMs: event.eventAtMs },
                cursor: { ...cursor, compositionEventAtMs: event.eventAtMs },
                applied: true,
            };
        case "party-closed":
            if (event.eventAtMs <= cursor.compositionEventAtMs) return { room, cursor, applied: false };
            return {
                room: {
                    ...room,
                    participants: event.participants,
                    closedAtMs: event.closedAtMs,
                    serverNowMs: event.eventAtMs,
                },
                cursor: { ...cursor, compositionEventAtMs: event.eventAtMs },
                applied: true,
            };
        case "heartbeat": {
            const participant = room.participants.find((member) => member.profileId === event.profileId);
            if (!participant || event.lastSeenAtMs <= participant.lastSeenAtMs) return { room, cursor, applied: false };
            return {
                room: {
                    ...room,
                    participants: room.participants.map((member) => member.profileId === event.profileId
                        ? { ...member, lastSeenAtMs: event.lastSeenAtMs }
                        : member),
                },
                cursor,
                applied: true,
            };
        }
        case "buffering":
            if (event.anchor.anchorVersion < room.anchor.anchorVersion) return { room, cursor, applied: false };
            return {
                room: {
                    ...room,
                    anchor: event.anchor,
                    bufferingWait: event.bufferingWait,
                    participants: event.participants,
                    serverNowMs: Math.max(room.serverNowMs, event.eventAtMs),
                },
                cursor,
                applied: true,
            };
        case "host-changed":
            if (event.eventAtMs <= cursor.compositionEventAtMs) return { room, cursor, applied: false };
            return {
                room: {
                    ...room,
                    hostProfileId: event.hostProfileId,
                    viewerRole: room.viewerProfileId === event.hostProfileId ? "host" : "guest",
                    participants: event.participants,
                    serverNowMs: event.eventAtMs,
                },
                cursor: { ...cursor, compositionEventAtMs: event.eventAtMs },
                applied: true,
            };
        case "control-mode":
            if (event.eventAtMs < cursor.compositionEventAtMs) return { room, cursor, applied: false };
            return {
                room: {
                    ...room,
                    controlMode: event.controlMode,
                    lastAction: { profileId: event.actorProfileId, kind: "control-mode", atMs: event.eventAtMs },
                    serverNowMs: event.eventAtMs,
                },
                cursor: { ...cursor, compositionEventAtMs: event.eventAtMs },
                applied: true,
            };
        case "chat":
            if (event.message.id <= cursor.lastChatMessageId) return { room, cursor, applied: false };
            return {
                room,
                cursor: { ...cursor, lastChatMessageId: event.message.id },
                applied: true,
            };
        case "typing":
            return { room, cursor, applied: true };
    }
};
