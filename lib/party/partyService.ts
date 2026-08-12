import type {
    WatchParty,
    WatchPartyAnchor,
    WatchPartyCommand,
    WatchPartyCommandRejection,
} from "@/lib/core/contracts";

export const PARTY_TTL_SECONDS = 6 * 60 * 60;
export const PARTY_MEMBER_TIMEOUT_MS = 45_000;

export interface CommandVerdict {
    ok: boolean;
    reason?: WatchPartyCommandRejection;
}

const clampPosition = (positionSeconds: number, durationSeconds?: number | null): number => {
    if (!Number.isFinite(positionSeconds) || positionSeconds <= 0) return 0;
    if (durationSeconds !== undefined && durationSeconds !== null && durationSeconds > 0) {
        return Math.min(positionSeconds, durationSeconds);
    }
    return positionSeconds;
};

export const resolvePosition = (
    anchor: WatchPartyAnchor,
    nowMs: number,
    durationSeconds?: number | null,
): number => {
    if (anchor.state !== "playing") {
        return clampPosition(anchor.positionSeconds, durationSeconds);
    }

    const elapsedSeconds = Math.max(0, (nowMs - anchor.anchorAtMs) / 1000);
    return clampPosition(anchor.positionSeconds + elapsedSeconds, durationSeconds);
};

export const isPartyAlive = (party: WatchParty, nowMs: number): boolean =>
    party.closedAtMs === null && party.expiresAtMs > nowMs;

export const isValidRoomCode = (value: string): boolean => /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,16}$/u.test(value);

export const normalizeRoomCode = (value: string): string | null => {
    const code = value.trim().toUpperCase();
    return isValidRoomCode(code) ? code : null;
};

export const canApplyCommand = (
    party: WatchParty,
    actorProfileId: number,
    command: WatchPartyCommand,
    nowMs: number,
): CommandVerdict => {
    if (!isPartyAlive(party, nowMs)) return { ok: false, reason: "closed" };
    if (party.controlMode === "everyone") return { ok: true };
    if (party.hostProfileId === actorProfileId) return { ok: true };
    return { ok: false, reason: "not-controller" };
};

export const nextAnchor = (
    party: WatchParty,
    command: WatchPartyCommand,
    nowMs: number,
    durationSeconds?: number | null,
): WatchPartyAnchor => {
    const anchorVersion = party.anchor.anchorVersion + 1;
    const currentPosition = resolvePosition(party.anchor, nowMs, durationSeconds);

    switch (command.kind) {
        case "play":
            return { state: "playing", positionSeconds: currentPosition, anchorAtMs: nowMs, anchorVersion };
        case "pause":
            return { state: "paused", positionSeconds: currentPosition, anchorAtMs: nowMs, anchorVersion };
        case "seek":
            return {
                state: party.anchor.state,
                positionSeconds: clampPosition(command.positionSeconds, durationSeconds),
                anchorAtMs: nowMs,
                anchorVersion,
            };
        case "episode-change":
            return { state: "paused", positionSeconds: 0, anchorAtMs: nowMs, anchorVersion };
    }
};

export const isAnchorNewer = (incoming: WatchPartyAnchor, known: WatchPartyAnchor): boolean =>
    incoming.anchorVersion > known.anchorVersion;

export const isMemberStale = (lastSeenAtMs: number, nowMs: number): boolean =>
    nowMs - lastSeenAtMs > PARTY_MEMBER_TIMEOUT_MS;
