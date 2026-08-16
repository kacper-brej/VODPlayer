import { describe, expect, it } from "vitest";
import {
    isPartyStorageKey,
    normalizePartyAttachment,
    partyAttachmentSrc,
    partyAttachmentExtension,
    sniffPartyAttachmentContentType,
} from "../partyAttachment";

const STORAGE_KEY = "party-chat/PZYY24/3f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b.png";

describe("partyAttachment", () => {
    it("przyjmuje klucz obiektu z własnego magazynu i rozpoznaje rodzaj", () => {
        expect(normalizePartyAttachment(STORAGE_KEY)).toEqual({ url: STORAGE_KEY, kind: "image" });
        expect(normalizePartyAttachment(STORAGE_KEY.replace(".png", ".gif"))?.kind).toBe("gif");
        expect(isPartyStorageKey(STORAGE_KEY)).toBe(true);
    });

    it("odrzuca klucze spoza prefiksu pokoju i z wędrówką po katalogach", () => {
        expect(normalizePartyAttachment("artwork/x/poster/3f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b.png")).toBeNull();
        expect(normalizePartyAttachment("party-chat/../secret.png")).toBeNull();
        expect(normalizePartyAttachment("party-chat/pzyy24/3f1a2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b.png")).toBeNull();
        expect(normalizePartyAttachment(STORAGE_KEY.replace(".png", ".svg"))).toBeNull();
    });

    it("nie przyjmuje żadnego adresu spoza własnego magazynu", () => {
        expect(normalizePartyAttachment("https://media1.tenor.com/x/kot.gif")).toBeNull();
        expect(normalizePartyAttachment("https://example.com/kot.gif")).toBeNull();
        expect(normalizePartyAttachment("javascript:alert(1)")).toBeNull();
        expect(normalizePartyAttachment("")).toBeNull();
    });

    it("każdy załącznik jest serwowany przez własny endpoint pokoju", () => {
        expect(partyAttachmentSrc("PZYY24", STORAGE_KEY))
            .toBe(`/api/party/PZYY24/attachment?key=${encodeURIComponent(STORAGE_KEY)}`);
    });

    it("rozpoznaje typ pliku po sygnaturze, nie po nagłówku od klienta", () => {
        expect(sniffPartyAttachmentContentType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
        expect(sniffPartyAttachmentContentType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39]))).toBe("image/gif");
        expect(sniffPartyAttachmentContentType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
        expect(partyAttachmentExtension("image/webp")).toBe("webp");
        expect(partyAttachmentExtension("application/pdf")).toBeNull();
    });
});
