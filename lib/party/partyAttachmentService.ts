import "server-only";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "@/lib/core/contracts";
import { getUserSeriesAccessLevel } from "@/lib/access/entitlements";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import * as repo from "@/lib/party/partyRepository";
import { normalizeRoomCode } from "@/lib/party/partyService";
import {
    isPartyStorageKey,
    partyAttachmentExtension,
    partyStorageKey,
    PARTY_ATTACHMENT_MAX_BYTES,
    sniffPartyAttachmentContentType,
} from "@/lib/party/partyAttachment";
import {
    PartyAttachmentStorageConfigError,
    presignPartyAttachmentObject,
    putPartyAttachmentObject,
} from "@/lib/party/partyAttachmentStorage";

const PRESIGN_TTL_SECONDS = 6 * 60 * 60;

export type PartyAttachmentFailure = "invalid" | "too-large" | "unavailable" | "storage" | "unconfigured";
export type PartyAttachmentUploadResult =
    | { ok: true; storageKey: string; kind: "image" | "gif" }
    | { ok: false; code: PartyAttachmentFailure };
export type PartyAttachmentLinkResult =
    | { ok: true; url: string }
    | { ok: false; code: PartyAttachmentFailure };

const requireMembership = async (user: AuthUser, code: string): Promise<boolean> => {
    const snapshot = await repo.findPartyByCode(code);
    if (snapshot === null) return false;
    if (await getUserSeriesAccessLevel(user, snapshot.party.seriesKey) !== "full") return false;
    const profileId = await resolveOwnedProfileId(user.id, user.username);
    return await repo.findMemberRole(snapshot.party.id, profileId) !== null;
};

export const uploadPartyAttachment = async (
    user: AuthUser,
    rawCode: string,
    data: Uint8Array,
): Promise<PartyAttachmentUploadResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null) return { ok: false, code: "invalid" };
    if (data.byteLength === 0) return { ok: false, code: "invalid" };
    if (data.byteLength > PARTY_ATTACHMENT_MAX_BYTES) return { ok: false, code: "too-large" };

    const contentType = sniffPartyAttachmentContentType(data);
    const extension = contentType === null ? null : partyAttachmentExtension(contentType);
    if (extension === null) return { ok: false, code: "invalid" };

    if (!await requireMembership(user, code)) return { ok: false, code: "unavailable" };

    const storageKey = partyStorageKey(code, randomUUID(), extension);
    try {
        await putPartyAttachmentObject(storageKey, Buffer.from(data));
    } catch (error) {
        if (error instanceof PartyAttachmentStorageConfigError) return { ok: false, code: "unconfigured" };
        return { ok: false, code: "storage" };
    }

    return { ok: true, storageKey, kind: extension === "gif" ? "gif" : "image" };
};

export const linkPartyAttachment = async (
    user: AuthUser,
    rawCode: string,
    storageKey: string,
): Promise<PartyAttachmentLinkResult> => {
    const code = normalizeRoomCode(rawCode);
    if (code === null || !isPartyStorageKey(storageKey)) return { ok: false, code: "invalid" };
    if (!storageKey.split("/")[1] || storageKey.split("/")[1] !== code) {
        return { ok: false, code: "invalid" };
    }
    if (!await requireMembership(user, code)) return { ok: false, code: "unavailable" };

    try {
        return { ok: true, url: await presignPartyAttachmentObject(storageKey, PRESIGN_TTL_SECONDS) };
    } catch (error) {
        if (error instanceof PartyAttachmentStorageConfigError) return { ok: false, code: "unconfigured" };
        return { ok: false, code: "storage" };
    }
};
