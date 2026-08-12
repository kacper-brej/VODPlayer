import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/lib/db/pool", () => ({ getDbPool: () => ({ execute }) }));

const {
    createParty,
    deleteFinishedParties,
    extendPartyLifetime,
    findPartyByCode,
    findPartyByCodeForUpdate,
    findMessageById,
    findReadyPartyEpisode,
    hasReadyPartyEpisode,
    joinParty,
    listStaleMembers,
    deletePartyMembers,
    listRecentMessages,
    touchMember,
    heartbeatMember,
    updatePlaybackAnchor,
} = await import("../partyRepository");

const db = { execute } as never;

const partyRow = (overrides: Record<string, unknown> = {}) => ({
    id: "1",
    room_code: "KXRT49",
    host_profile_id: "10",
    series_key: "Steins Gate",
    episode_key: "01.mp4",
    state: "playing",
    position_seconds: "731.500",
    anchor_version: "4",
    control_mode: "host",
    position_updated_at_ms: "1700000000000",
    created_at_ms: "1699999000000",
    expires_at_ms: "1700003600000",
    closed_at_ms: null,
    server_now_ms: "1700000030000",
    ...overrides,
});

beforeEach(() => execute.mockReset());

describe("odczyt pokoju", () => {
    it("mapuje kotwicę razem z czasem serwera z tego samego zapytania", async () => {
        execute.mockResolvedValueOnce([[partyRow()]]);

        const snapshot = await findPartyByCode("KXRT49", db);

        expect(snapshot?.serverNowMs).toBe(1_700_000_030_000);
        expect(snapshot?.party.anchor).toEqual({
            state: "playing",
            positionSeconds: 731.5,
            anchorAtMs: 1_700_000_000_000,
            anchorVersion: 4,
        });
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("odczyt do mutacji blokuje wiersz pokoju", async () => {
        execute.mockResolvedValueOnce([[partyRow()]]);

        await findPartyByCodeForUpdate("KXRT49", db);

        const [sql] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("FOR UPDATE");
    });

    it("sprawdza gotowy odcinek po parze kluczy", async () => {
        execute.mockResolvedValueOnce([[{ found: 1 }]]);

        await expect(hasReadyPartyEpisode("Steins Gate", "01.mp4", db)).resolves.toBe(true);
        expect(execute.mock.calls[0]?.[1]).toEqual(["Steins Gate", "01.mp4"]);
    });

    it("czyta czas trwania odcinka do ograniczenia seeka", async () => {
        execute.mockResolvedValueOnce([[{ duration_seconds: "1440.500" }]]);

        await expect(findReadyPartyEpisode("Steins Gate", "01.mp4", db)).resolves.toEqual({
            durationSeconds: 1440.5,
        });
    });

    it("czyta czas serwera bazy, a nie czas procesu aplikacji", async () => {
        execute.mockResolvedValueOnce([[partyRow()]]);

        await findPartyByCode("KXRT49", db);

        const [sql] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000) AS server_now_ms");
    });

    it("pozycja z kolumny DECIMAL wraca jako liczba, nie jako tekst", async () => {
        execute.mockResolvedValueOnce([[partyRow({ position_seconds: "0.000" })]]);

        const snapshot = await findPartyByCode("KXRT49", db);

        expect(snapshot?.party.anchor.positionSeconds).toBe(0);
    });

    it("brak pokoju daje null zamiast wyjątku", async () => {
        execute.mockResolvedValueOnce([[]]);

        await expect(findPartyByCode("NIEMA", db)).resolves.toBeNull();
    });

    it("zamknięty pokój ma znacznik zamknięcia jako liczbę", async () => {
        execute.mockResolvedValueOnce([[partyRow({ closed_at_ms: "1700000100000" })]]);

        const snapshot = await findPartyByCode("KXRT49", db);

        expect(snapshot?.party.closedAtMs).toBe(1_700_000_100_000);
    });
});

describe("zapis kotwicy", () => {
    it("znacznik czasu ustawia baza, a nie wartość z parametrów", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

        await updatePlaybackAnchor(
            { partyId: 1, expectedVersion: 4, anchor: { state: "paused", positionSeconds: 120 } },
            db,
        );

        const [sql, params] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("position_updated_at = CURRENT_TIMESTAMP(3)");
        expect(params).toEqual(["paused", 120, null, 1, 4]);
    });

    it("zapis jest warunkowy po wersji kotwicy i po tym, że pokój nie jest zamknięty", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

        await updatePlaybackAnchor(
            { partyId: 1, expectedVersion: 4, anchor: { state: "playing", positionSeconds: 10 } },
            db,
        );

        const [sql] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("WHERE id = ? AND closed_at IS NULL AND anchor_version = ?");
        expect(sql).toContain("anchor_version = anchor_version + 1");
    });

    it("komenda oparta na nieaktualnej wersji nie zmienia wiersza", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 0 }]);

        await expect(updatePlaybackAnchor(
            { partyId: 1, expectedVersion: 2, anchor: { state: "paused", positionSeconds: 5 } },
            db,
        )).resolves.toBe(false);
    });

    it("dwa zapisy pod rząd zostawiają stan z drugiego, bo drugi startuje z podniesionej wersji", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

        await updatePlaybackAnchor(
            { partyId: 1, expectedVersion: 4, anchor: { state: "playing", positionSeconds: 100 } },
            db,
        );
        await updatePlaybackAnchor(
            { partyId: 1, expectedVersion: 5, anchor: { state: "paused", positionSeconds: 130 } },
            db,
        );

        expect(execute.mock.calls[0]?.[1]).toEqual(["playing", 100, null, 1, 4]);
        expect(execute.mock.calls[1]?.[1]).toEqual(["paused", 130, null, 1, 5]);
    });

    it("brak nowego odcinka nie nadpisuje dotychczasowego", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

        await updatePlaybackAnchor(
            { partyId: 1, expectedVersion: 4, anchor: { state: "paused", positionSeconds: 0 } },
            db,
        );

        const [sql] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("episode_key = COALESCE(?, episode_key)");
    });
});

describe("uczestnicy", () => {
    it("ponowne dołączenie odświeża obecność zamiast błędu duplikatu", async () => {
        execute.mockResolvedValueOnce([{}]);

        await joinParty(1, 10, "host", db);

        const [sql, params] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP(3)");
        expect(params).toEqual([1, 10, "host"]);
    });

    it("odświeżenie obecności kogoś spoza pokoju zwraca false", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 0 }]);

        await expect(touchMember(1, 999, false, db)).resolves.toBe(false);
    });

    it("heartbeat nie zeruje trwającego buforowania", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 1 }]);

        await heartbeatMember(1, 10, db);

        const [sql, params] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("SET last_seen_at = CURRENT_TIMESTAMP(3)");
        expect(sql).not.toContain("is_buffering");
        expect(params).toEqual([1, 10]);
    });

    it("przedłużenie życia nie dotyka kotwicy odtwarzania", async () => {
        execute.mockResolvedValueOnce([{}]);

        await extendPartyLifetime(1, 3600, db);

        const [sql, params] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("SET expires_at");
        expect(sql).not.toContain("position_seconds");
        expect(sql).not.toContain("position_updated_at");
        expect(params).toEqual([1]);
    });

    it("wybiera duchy pod blokadą i usuwa je jednym przygotowanym DELETE", async () => {
        execute.mockResolvedValueOnce([[
            { profile_id: "11", role: "guest" },
            { profile_id: "12", role: "guest" },
        ]]);
        execute.mockResolvedValueOnce([{ affectedRows: 2 }]);

        await expect(listStaleMembers(1, 45, db)).resolves.toEqual([
            { profileId: 11, role: "guest" },
            { profileId: 12, role: "guest" },
        ]);
        await expect(deletePartyMembers(1, [11, 12], db)).resolves.toBe(2);

        expect(execute.mock.calls[0]?.[0]).toContain("FOR UPDATE");
        expect(execute.mock.calls[1]?.[1]).toEqual([1, 11, 12]);
    });
});

describe("wiadomości i sprzątanie", () => {
    it("historia wraca w kolejności chronologicznej mimo pobrania od najnowszej", async () => {
        execute.mockResolvedValueOnce([[
            { id: "3", profile_id: "10", body: "trzecia", created_at_ms: "1700000003000" },
            { id: "2", profile_id: "11", body: "druga", created_at_ms: "1700000002000" },
        ]]);

        const messages = await listRecentMessages(1, 50, db);

        expect(messages.map((message) => message.body)).toEqual(["druga", "trzecia"]);
    });

    it("limit historii poza zakresem jest odrzucany przed dotknięciem bazy", async () => {
        await expect(listRecentMessages(1, 5_000, db)).rejects.toThrow(/1-200/);
        expect(execute).not.toHaveBeenCalled();
    });

    it("sprzątanie usuwa wygasłe oraz zamknięte poza okresem retencji", async () => {
        execute.mockResolvedValueOnce([{ affectedRows: 3 }]);

        await expect(deleteFinishedParties(86_400, 100, db)).resolves.toBe(3);

        const [sql] = execute.mock.calls[0] ?? [];
        expect(sql).toContain("expires_at < CURRENT_TIMESTAMP(3)");
        expect(sql).toContain("closed_at < CURRENT_TIMESTAMP(3) - INTERVAL 86400 SECOND");
        expect(sql).toContain("DELETE FROM watch_parties");
    });

    it("czas życia pokoju poza rozsądnym zakresem jest odrzucany", async () => {
        await expect(createParty(
            { roomCode: "KXRT49", hostProfileId: 10, seriesKey: "S", episodeKey: "01.mp4", ttlSeconds: 0 },
            db,
        )).rejects.toThrow(/1-604800/);
        expect(execute).not.toHaveBeenCalled();
    });
});

describe("odczyt pojedynczej wiadomości", () => {
    it("zwraca wiadomość z czasem zapisu z zegara bazy", async () => {
        execute.mockResolvedValueOnce([[
            { id: "42", profile_id: "10", body: "cześć", created_at_ms: "1700000000500" },
        ]]);

        await expect(findMessageById(42, db)).resolves.toEqual({
            id: 42,
            profileId: 10,
            body: "cześć",
            createdAtMs: 1_700_000_000_500,
        });
    });

    it("nieistniejąca wiadomość daje null zamiast wyjątku", async () => {
        execute.mockResolvedValueOnce([[]]);

        await expect(findMessageById(999, db)).resolves.toBeNull();
    });

    it("treść ze znacznikami HTML wraca bez żadnej transformacji", async () => {
        execute.mockResolvedValueOnce([[
            { id: "1", profile_id: "10", body: "<b>cześć</b>", created_at_ms: "1700000000000" },
        ]]);

        const message = await findMessageById(1, db);

        expect(message?.body).toBe("<b>cześć</b>");
    });
});
