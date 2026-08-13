export type PartyAttachmentKind = "image" | "gif";

export interface PartyAttachment {
    url: string;
    kind: PartyAttachmentKind;
}

export const PARTY_ATTACHMENT_MAX_URL_LENGTH = 1024;
export const PARTY_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;
export const PARTY_ATTACHMENT_PREFIX = "party-chat";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
};

const STORAGE_KEY_PATTERN = new RegExp(
    `^${PARTY_ATTACHMENT_PREFIX}/[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6,16}/`
    + "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"
    + "\\.(jpg|png|webp|gif)$",
    "u",
);

export const isPartyStorageKey = (value: string): boolean => STORAGE_KEY_PATTERN.test(value);

export const partyAttachmentExtension = (contentType: string): string | null =>
    EXTENSION_BY_CONTENT_TYPE[contentType.split(";")[0]?.trim().toLowerCase() ?? ""] ?? null;

export const partyAttachmentContentType = (objectKey: string): string => {
    const extension = objectKey.slice(objectKey.lastIndexOf(".") + 1).toLowerCase();
    return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
};

export const partyStorageKey = (roomCode: string, id: string, extension: string): string =>
    `${PARTY_ATTACHMENT_PREFIX}/${roomCode}/${id}.${extension}`;

export const normalizePartyAttachment = (raw: unknown): PartyAttachment | null => {
    if (typeof raw !== "string") return null;
    const candidate = raw.trim();
    if (candidate.length > PARTY_ATTACHMENT_MAX_URL_LENGTH || !isPartyStorageKey(candidate)) return null;
    return { url: candidate, kind: candidate.endsWith(".gif") ? "gif" : "image" };
};

export const partyAttachmentSrc = (roomCode: string, attachmentUrl: string): string =>
    `/api/party/${encodeURIComponent(roomCode)}/attachment?key=${encodeURIComponent(attachmentUrl)}`;

const startsWith = (data: Uint8Array, signature: number[], offset = 0): boolean =>
    signature.every((byte, index) => data[offset + index] === byte);

export const sniffPartyAttachmentContentType = (data: Uint8Array): string | null => {
    if (startsWith(data, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
    if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) {
        return "image/webp";
    }
    return null;
};
