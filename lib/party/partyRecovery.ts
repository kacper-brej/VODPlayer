import type { WatchPartyRoomState } from "@/lib/core/contracts";
import { resolvePosition } from "@/lib/party/partyService";

export const PARTY_RECONNECT_BACKOFF_MS = [0, 1_000, 2_000, 4_000, 8_000, 16_000] as const;
export const PARTY_HEARTBEAT_INTERVAL_MS = 15_000;

export const partyReconnectDelay = (attempt: number): number | null => {
    if (!Number.isSafeInteger(attempt) || attempt < 0 || attempt >= PARTY_RECONNECT_BACKOFF_MS.length) {
        return null;
    }
    return PARTY_RECONNECT_BACKOFF_MS[attempt] ?? null;
};

export const recoveredPartyPosition = (
    room: WatchPartyRoomState,
    clockOffsetMs: number,
    clientNowMs: number,
): number => resolvePosition(room.anchor, clientNowMs + clockOffsetMs);
