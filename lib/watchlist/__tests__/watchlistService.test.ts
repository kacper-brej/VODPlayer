import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

const repo = {
    listWatchlistForProfile: vi.fn(),
    upsertWatchlistItem: vi.fn(),
    deleteWatchlistItem: vi.fn(),
};
vi.mock("@/lib/watchlist/watchlistRepository", () => repo);

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const { getWatchlist, addToWatchlist, removeFromWatchlist } = await import("../watchlistService");

const USER_ID = 1;
const USERNAME = "Kacper";
const PROFILE_ID = 5;

beforeEach(() => {
    vi.clearAllMocks();
    resolveOwnedProfileId.mockResolvedValue(PROFILE_ID);
});

describe("getWatchlist — profil zawsze rozwiazywany przez resolveOwnedProfileId (M5)", () => {
    it("nie ufa surowemu ID, deleguje ustalenie profilu", async () => {
        repo.listWatchlistForProfile.mockResolvedValue([]);
        await getWatchlist(USER_ID, USERNAME);
        expect(resolveOwnedProfileId).toHaveBeenCalledWith(USER_ID, USERNAME);
        expect(repo.listWatchlistForProfile).toHaveBeenCalledWith(PROFILE_ID);
    });
});

describe("addToWatchlist — walidacja", () => {
    it("pusty seriesKey -> invalid, brak zapisu", async () => {
        await expect(addToWatchlist(USER_ID, USERNAME, "  ")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(resolveOwnedProfileId).not.toHaveBeenCalled();
        expect(repo.upsertWatchlistItem).not.toHaveBeenCalled();
    });

    it("seriesKey dluzszy niz 255 znakow -> invalid", async () => {
        await expect(addToWatchlist(USER_ID, USERNAME, "x".repeat(256))).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("sukces -- idempotentny upsert na profilu wywolujacego", async () => {
        await expect(addToWatchlist(USER_ID, USERNAME, "Naruto")).resolves.toEqual({ ok: true, seriesKey: "Naruto" });
        expect(repo.upsertWatchlistItem).toHaveBeenCalledWith(PROFILE_ID, "Naruto");
    });

    it("blad bazy -> server", async () => {
        repo.upsertWatchlistItem.mockRejectedValueOnce(new DatabaseError("unknown", 500, "blad"));
        await expect(addToWatchlist(USER_ID, USERNAME, "Naruto")).resolves.toEqual({ ok: false, code: "server" });
    });
});

describe("removeFromWatchlist — walidacja i brak zasobu", () => {
    it("pusty seriesKey -> invalid", async () => {
        await expect(removeFromWatchlist(USER_ID, USERNAME, "")).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("usuniecie nieistniejacej pozycji nadal zwraca sukces (zgodnie z PHP -- DELETE jest idempotentny)", async () => {
        await expect(removeFromWatchlist(USER_ID, USERNAME, "Nieistniejacy")).resolves.toEqual({
            ok: true,
            seriesKey: "Nieistniejacy",
        });
        expect(repo.deleteWatchlistItem).toHaveBeenCalledWith(PROFILE_ID, "Nieistniejacy");
    });
});

describe("rownolegle przelaczanie watchlisty tego samego serialu", () => {
    it("dodanie i usuniecie wystrzelone rownolegle -- oba rozwiazuja profil niezaleznie i trafiaja do repo", async () => {
        const [added, removed] = await Promise.all([
            addToWatchlist(USER_ID, USERNAME, "Naruto"),
            removeFromWatchlist(USER_ID, USERNAME, "Bleach"),
        ]);

        expect(added).toEqual({ ok: true, seriesKey: "Naruto" });
        expect(removed).toEqual({ ok: true, seriesKey: "Bleach" });
        expect(resolveOwnedProfileId).toHaveBeenCalledTimes(2);
        expect(repo.upsertWatchlistItem).toHaveBeenCalledWith(PROFILE_ID, "Naruto");
        expect(repo.deleteWatchlistItem).toHaveBeenCalledWith(PROFILE_ID, "Bleach");
    });
});
