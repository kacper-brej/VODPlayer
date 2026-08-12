import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserSeriesAccessLevel = vi.fn();
vi.mock("@/lib/access/entitlements", () => ({ getUserSeriesAccessLevel }));

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const findPartyByCode = vi.fn();
const findMemberRole = vi.fn();
const insertMessage = vi.fn();
const findMessageById = vi.fn();
vi.mock("@/lib/party/partyRepository", () => ({
    findPartyByCode,
    findMemberRole,
    insertMessage,
    findMessageById,
}));

const publishPartyEvent = vi.fn();
vi.mock("@/lib/party/realtimeChannel", () => ({ publishPartyEvent }));

const { normalizePartyMessageBody, postPartyMessage } = await import("../partyChatService");
const { PARTY_MESSAGE_MAX_LENGTH } = await import("../partyMessageLimits");

const NOW = 1_700_000_000_000;
const user = { id: 1, username: "kacper" } as never;

const snapshot = () => ({
    serverNowMs: NOW,
    party: {
        id: 5,
        roomCode: "KXRT49",
        hostProfileId: 10,
        seriesKey: "Steins Gate",
        episodeKey: "01.mp4",
        controlMode: "host",
        anchor: { state: "paused", positionSeconds: 0, anchorAtMs: NOW, anchorVersion: 0 },
        createdAtMs: NOW - 1000,
        expiresAtMs: NOW + 3_600_000,
        closedAtMs: null,
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    getUserSeriesAccessLevel.mockResolvedValue("full");
    resolveOwnedProfileId.mockResolvedValue(10);
    findPartyByCode.mockResolvedValue(snapshot());
    findMemberRole.mockResolvedValue("guest");
    insertMessage.mockResolvedValue(42);
    findMessageById.mockResolvedValue({ id: 42, profileId: 10, body: "cześć", createdAtMs: NOW + 500 });
});

describe("normalizacja treści wiadomości", () => {
    it("przycina białe znaki z brzegów", () => {
        expect(normalizePartyMessageBody("  hej  ")).toBe("hej");
    });

    it("odrzuca pustą wiadomość i samą spację", () => {
        expect(normalizePartyMessageBody("")).toBeNull();
        expect(normalizePartyMessageBody("   ")).toBeNull();
    });

    it("odrzuca wiadomość dłuższą niż limit", () => {
        expect(normalizePartyMessageBody("a".repeat(PARTY_MESSAGE_MAX_LENGTH + 1))).toBeNull();
    });

    it("dopuszcza wiadomość dokładnie na granicy limitu", () => {
        const body = "a".repeat(PARTY_MESSAGE_MAX_LENGTH);
        expect(normalizePartyMessageBody(body)).toBe(body);
    });

    it("odrzuca wartość, która nie jest tekstem", () => {
        expect(normalizePartyMessageBody(123)).toBeNull();
        expect(normalizePartyMessageBody(null)).toBeNull();
    });
});

describe("wysyłanie wiadomości", () => {
    it("wiadomość dłuższa niż limit jest odrzucona przed dotknięciem bazy", async () => {
        const result = await postPartyMessage(user, "KXRT49", "a".repeat(PARTY_MESSAGE_MAX_LENGTH + 1));

        expect(result).toEqual({ ok: false, code: "invalid" });
        expect(findPartyByCode).not.toHaveBeenCalled();
    });

    it("konto bez pełnego dostępu do serialu nie zapisze wiadomości", async () => {
        getUserSeriesAccessLevel.mockResolvedValue("demo");

        const result = await postPartyMessage(user, "KXRT49", "cześć");

        expect(result).toEqual({ ok: false, code: "unavailable" });
        expect(insertMessage).not.toHaveBeenCalled();
    });

    it("konto spoza pokoju nie zapisze wiadomości", async () => {
        findMemberRole.mockResolvedValue(null);

        const result = await postPartyMessage(user, "KXRT49", "cześć");

        expect(result).toEqual({ ok: false, code: "unavailable" });
        expect(insertMessage).not.toHaveBeenCalled();
    });

    it("nieistniejący pokój jest nieodróżnialny od braku uprawnienia", async () => {
        findPartyByCode.mockResolvedValue(null);

        await expect(postPartyMessage(user, "KXRT49", "cześć")).resolves.toEqual({
            ok: false,
            code: "unavailable",
        });
    });

    it("treść ze znacznikami HTML trafia do zapisu bez żadnej zmiany", async () => {
        await postPartyMessage(user, "KXRT49", '<b>cześć</b> & <script>alert(1)</script>');

        expect(insertMessage).toHaveBeenCalledWith(5, 10, '<b>cześć</b> & <script>alert(1)</script>');
    });

    it("znacznik czasu zdarzenia pochodzi z zegara bazy, nie z Date.now()", async () => {
        findMessageById.mockResolvedValue({ id: 42, profileId: 10, body: "cześć", createdAtMs: NOW + 999_000 });

        const result = await postPartyMessage(user, "KXRT49", "cześć");

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.event.eventAtMs).toBe(NOW + 999_000);
    });

    it("wysłana wiadomość jest rozgłaszana na kanale tego pokoju", async () => {
        await postPartyMessage(user, "KXRT49", "cześć");

        expect(publishPartyEvent).toHaveBeenCalledWith("KXRT49", {
            name: "chat",
            data: expect.objectContaining({ type: "chat", roomCode: "KXRT49" }),
        });
    });

    it("awaria kanału nie unieważnia już zapisanej wiadomości", async () => {
        publishPartyEvent.mockRejectedValue(new Error("upstream down"));

        const result = await postPartyMessage(user, "KXRT49", "cześć");

        expect(result.ok).toBe(true);
    });

    it("brak konta w pokoju jest sprawdzany po tym samym profilu, który zapisuje wiadomość", async () => {
        await postPartyMessage(user, "KXRT49", "cześć");

        expect(findMemberRole).toHaveBeenCalledWith(5, 10);
        expect(insertMessage).toHaveBeenCalledWith(5, 10, "cześć");
    });
});
