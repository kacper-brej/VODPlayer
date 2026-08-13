import type { WatchPartyMember, WatchPartyMessage } from "@/lib/core/contracts";
import type { PartyEvent } from "@/lib/party/partyEvents";

export type PartyUploadResult =
    | { ok: true; storageKey: string }
    | { ok: false; message: string };

export interface PartyNotice {
    id: string;
    atMs: number;
    text: string;
}

export type PartyFeedEntry =
    | { kind: "message"; id: string; atMs: number; message: WatchPartyMessage }
    | { kind: "notice"; id: string; atMs: number; text: string };

export const PARTY_NOTICE_HISTORY_LIMIT = 30;
export const PARTY_BURST_GAP_MS = 5 * 60 * 1000;

export type PartyFeedGroup =
    | { kind: "notice"; id: string; text: string; parting: boolean }
    | {
        kind: "burst";
        id: string;
        profileId: number;
        own: boolean;
        name: string;
        avatar: string | null;
        atMs: number;
        messages: WatchPartyMessage[];
    };

export const groupPartyFeed = (
    entries: PartyFeedEntry[],
    viewerProfileId: number,
    gapMs: number = PARTY_BURST_GAP_MS,
): PartyFeedGroup[] => {
    const groups: PartyFeedGroup[] = [];

    for (const entry of entries) {
        if (entry.kind === "notice") {
            groups.push({
                kind: "notice",
                id: entry.id,
                text: entry.text,
                parting: entry.id.startsWith("n-left-"),
            });
            continue;
        }

        const previous = groups.at(-1);
        const { message } = entry;
        if (
            previous !== undefined
            && previous.kind === "burst"
            && previous.profileId === message.profileId
            && message.createdAtMs - (previous.messages.at(-1)?.createdAtMs ?? 0) <= gapMs
        ) {
            previous.messages.push(message);
            continue;
        }

        groups.push({
            kind: "burst",
            id: entry.id,
            profileId: message.profileId,
            own: message.profileId === viewerProfileId,
            name: message.authorName ?? "Widz",
            avatar: message.authorAvatar ?? null,
            atMs: message.createdAtMs,
            messages: [message],
        });
    }

    return groups;
};

export const buildPartyFeed = (
    messages: WatchPartyMessage[],
    notices: PartyNotice[],
): PartyFeedEntry[] => [
    ...messages.map((message): PartyFeedEntry => ({
        kind: "message",
        id: `m${message.id}`,
        atMs: message.createdAtMs,
        message,
    })),
    ...notices.map((notice): PartyFeedEntry => ({
        kind: "notice",
        id: notice.id,
        atMs: notice.atMs,
        text: notice.text,
    })),
].sort((left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id));

export type PartyKnownNames = Readonly<Record<number, string>>;

export const mergeKnownNames = (
    known: PartyKnownNames,
    participants: readonly WatchPartyMember[],
): PartyKnownNames => {
    const missing = participants.filter((member) => known[member.profileId] !== member.name);
    if (missing.length === 0) return known;
    return { ...known, ...Object.fromEntries(missing.map((member) => [member.profileId, member.name])) };
};

const formatPosition = (positionSeconds: number): string => {
    const total = Math.max(0, Math.round(positionSeconds));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const noticeForEvent = (
    event: PartyEvent,
    knownNames: PartyKnownNames,
): PartyNotice | null => {
    const nameOf = (profileId: number): string => knownNames[profileId] ?? "Ktoś";

    if (event.type === "member-joined") {
        const arrivals = event.participants.filter((member: WatchPartyMember) => knownNames[member.profileId] === undefined);
        if (arrivals.length === 0) return null;
        return {
            id: `n-join-${event.eventAtMs}-${arrivals.map((member) => member.profileId).join("-")}`,
            atMs: event.eventAtMs,
            text: arrivals.length === 1
                ? `${arrivals[0]!.name} jest już z wami`
                : `${arrivals.map((member) => member.name).join(", ")} są już z wami`,
        };
    }

    if (event.type === "member-left") {
        return {
            id: `n-left-${event.eventAtMs}-${event.profileId}`,
            atMs: event.eventAtMs,
            text: `${nameOf(event.profileId)} wyszedł(a) z pokoju`,
        };
    }

    if (event.type === "host-changed") {
        return {
            id: `n-host-${event.eventAtMs}-${event.hostProfileId}`,
            atMs: event.eventAtMs,
            text: `Pokój prowadzi teraz ${nameOf(event.hostProfileId)}`,
        };
    }

    if (event.type === "seek") {
        return {
            id: `n-seek-${event.anchor.anchorVersion}`,
            atMs: event.eventAtMs,
            text: `${nameOf(event.actorProfileId)} przewinął(-ęła) do ${formatPosition(event.anchor.positionSeconds)}`,
        };
    }

    if (event.type === "episode-change") {
        return {
            id: `n-episode-${event.anchor.anchorVersion}`,
            atMs: event.eventAtMs,
            text: `${nameOf(event.actorProfileId)} włączył(a) inny odcinek`,
        };
    }

    return null;
};
