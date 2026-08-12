import { describe, expect, it, vi, beforeEach } from "vitest";
import { DatabaseError } from "@/lib/db/errors";

vi.mock("@/lib/db/transaction", () => ({
    withTransaction: async (work: (connection: unknown) => Promise<unknown>) => work({}),
}));

const repo = {
    listCollectionsForProfile: vi.fn(),
    countCollectionsForProfile: vi.fn(),
    isCollectionOwnedByProfile: vi.fn(),
    getCollectionMeta: vi.fn(),
    listCollectionItems: vi.fn(),
    insertCollection: vi.fn(),
    renameCollectionById: vi.fn(),
    deleteCollectionItemsByCollectionId: vi.fn(),
    deleteCollectionById: vi.fn(),
    upsertCollectionItem: vi.fn(),
    deleteCollectionItem: vi.fn(),
};
vi.mock("@/lib/collections/collectionRepository", () => repo);

const resolveOwnedProfileId = vi.fn();
vi.mock("@/lib/profiles/profileService", () => ({ resolveOwnedProfileId }));

const {
    listCollections,
    getCollectionDetail,
    createCollection,
    renameCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
} = await import("../collectionService");

const USER_ID = 1;
const USERNAME = "Kacper";
const PROFILE_ID = 5;

beforeEach(() => {
    vi.clearAllMocks();
    resolveOwnedProfileId.mockResolvedValue(PROFILE_ID);
});

describe("listCollections", () => {
    it("deleguje rozwiazanie profilu do resolveOwnedProfileId", async () => {
        repo.listCollectionsForProfile.mockResolvedValue([]);
        await listCollections(USER_ID, USERNAME);
        expect(resolveOwnedProfileId).toHaveBeenCalledWith(USER_ID, USERNAME);
        expect(repo.listCollectionsForProfile).toHaveBeenCalledWith(PROFILE_ID);
    });
});

describe("getCollectionDetail — walidacja i IDOR", () => {
    it("nieprawidlowe id (0, ujemne, niecalkowite) -> invalid, brak zapytan do DB", async () => {
        await expect(getCollectionDetail(USER_ID, USERNAME, 0)).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(getCollectionDetail(USER_ID, USERNAME, -1)).resolves.toEqual({ ok: false, code: "invalid" });
        await expect(getCollectionDetail(USER_ID, USERNAME, 1.5)).resolves.toEqual({ ok: false, code: "invalid" });
        expect(resolveOwnedProfileId).not.toHaveBeenCalled();
    });

    it("obca kolekcja (inny profil) -> forbidden, bez ujawniania danych", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(false);
        await expect(getCollectionDetail(USER_ID, USERNAME, 99)).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.getCollectionMeta).not.toHaveBeenCalled();
    });

    it("wlasna kolekcja -> szczegoly z metadanymi i itemami", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(true);
        repo.getCollectionMeta.mockResolvedValue({ name: "Ulubione", createdAt: 1000 });
        repo.listCollectionItems.mockResolvedValue(["Naruto"]);

        await expect(getCollectionDetail(USER_ID, USERNAME, 1)).resolves.toEqual({
            ok: true,
            detail: { id: 1, name: "Ulubione", createdAt: 1000, items: ["Naruto"] },
        });
    });
});

describe("createCollection — walidacja nazwy i limit", () => {
    it("pusta nazwa (po trim) -> invalid", async () => {
        await expect(createCollection(USER_ID, USERNAME, "   ")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(resolveOwnedProfileId).not.toHaveBeenCalled();
    });

    it("nazwa dluzsza niz 100 znakow -> invalid", async () => {
        await expect(createCollection(USER_ID, USERNAME, "x".repeat(101))).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("limit 20 kolekcji na profil osiagniety -> limit, brak INSERT", async () => {
        repo.countCollectionsForProfile.mockResolvedValue(20);
        await expect(createCollection(USER_ID, USERNAME, "Nowa")).resolves.toEqual({ ok: false, code: "limit" });
        expect(repo.insertCollection).not.toHaveBeenCalled();
    });

    it("duplikat nazwy (ER_DUP_ENTRY zmapowany na DatabaseError conflict) -> conflict", async () => {
        repo.countCollectionsForProfile.mockResolvedValue(0);
        repo.insertCollection.mockRejectedValue(new DatabaseError("conflict", 409, "duplikat"));
        await expect(createCollection(USER_ID, USERNAME, "Ulubione")).resolves.toEqual({ ok: false, code: "conflict" });
    });

    it("inny blad bazy -> server", async () => {
        repo.countCollectionsForProfile.mockResolvedValue(0);
        repo.insertCollection.mockRejectedValue(new DatabaseError("unknown", 500, "blad"));
        await expect(createCollection(USER_ID, USERNAME, "Ulubione")).resolves.toEqual({ ok: false, code: "server" });
    });

    it("sukces -> zwraca id, przycieta nazwa i createdAt", async () => {
        repo.countCollectionsForProfile.mockResolvedValue(0);
        repo.insertCollection.mockResolvedValue(7);
        repo.getCollectionMeta.mockResolvedValue({ name: "Ulubione", createdAt: 2000 });

        await expect(createCollection(USER_ID, USERNAME, "  Ulubione  ")).resolves.toEqual({
            ok: true,
            id: 7,
            name: "Ulubione",
            createdAt: 2000,
        });
    });
});

describe("renameCollection — IDOR i duplikaty", () => {
    it("obca kolekcja -> forbidden, brak UPDATE", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(false);
        await expect(renameCollection(USER_ID, USERNAME, 99, "Nowa nazwa")).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.renameCollectionById).not.toHaveBeenCalled();
    });

    it("sukces -> id i przycieta nazwa", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(true);
        await expect(renameCollection(USER_ID, USERNAME, 1, "  Nowa  ")).resolves.toEqual({ ok: true, id: 1, name: "Nowa" });
    });
});

describe("deleteCollection — granica transakcji (SEC-23)", () => {
    it("obca kolekcja -> forbidden, transakcja nigdy nie startuje", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(false);
        await expect(deleteCollection(USER_ID, USERNAME, 99)).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.deleteCollectionItemsByCollectionId).not.toHaveBeenCalled();
        expect(repo.deleteCollectionById).not.toHaveBeenCalled();
    });

    it("sukces -> usuwa items przed kolekcja, w tej samej transakcji", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(true);
        await expect(deleteCollection(USER_ID, USERNAME, 1)).resolves.toEqual({ ok: true });

        expect(repo.deleteCollectionItemsByCollectionId).toHaveBeenCalledWith(1, {});
        expect(repo.deleteCollectionById).toHaveBeenCalledWith(1, {});

        const itemsCallOrder = repo.deleteCollectionItemsByCollectionId.mock.invocationCallOrder[0];
        const collectionCallOrder = repo.deleteCollectionById.mock.invocationCallOrder[0];
        expect(itemsCallOrder).toBeLessThan(collectionCallOrder as number);
    });

    it("blad przy usuwaniu items przerywa transakcje -- deleteCollectionById NIGDY nie jest wywolane", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(true);
        repo.deleteCollectionItemsByCollectionId.mockRejectedValue(new DatabaseError("unknown", 500, "blad"));

        await expect(deleteCollection(USER_ID, USERNAME, 1)).resolves.toEqual({ ok: false, code: "server" });
        expect(repo.deleteCollectionById).not.toHaveBeenCalled();
    });
});

describe("addToCollection / removeFromCollection — walidacja i IDOR", () => {
    it("pusty seriesKey -> invalid", async () => {
        await expect(addToCollection(USER_ID, USERNAME, 1, "  ")).resolves.toEqual({ ok: false, code: "invalid" });
        expect(resolveOwnedProfileId).not.toHaveBeenCalled();
    });

    it("seriesKey dluzszy niz 255 znakow -> invalid", async () => {
        await expect(addToCollection(USER_ID, USERNAME, 1, "x".repeat(256))).resolves.toEqual({ ok: false, code: "invalid" });
    });

    it("obca kolekcja -> forbidden, brak zapisu", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(false);
        await expect(addToCollection(USER_ID, USERNAME, 99, "Naruto")).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.upsertCollectionItem).not.toHaveBeenCalled();
    });

    it("dodanie -- idempotentny upsert", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(true);
        await expect(addToCollection(USER_ID, USERNAME, 1, "Naruto")).resolves.toEqual({ ok: true, seriesKey: "Naruto" });
        expect(repo.upsertCollectionItem).toHaveBeenCalledWith(1, "Naruto");
    });

    it("usuniecie z obcej kolekcji -> forbidden", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(false);
        await expect(removeFromCollection(USER_ID, USERNAME, 99, "Naruto")).resolves.toEqual({ ok: false, code: "forbidden" });
        expect(repo.deleteCollectionItem).not.toHaveBeenCalled();
    });

    it("usuniecie -- sukces", async () => {
        repo.isCollectionOwnedByProfile.mockResolvedValue(true);
        await expect(removeFromCollection(USER_ID, USERNAME, 1, "Naruto")).resolves.toEqual({ ok: true });
    });
});
