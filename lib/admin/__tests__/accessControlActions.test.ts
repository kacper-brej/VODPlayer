import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ updateTag }));

const service = {
    getSeriesAccessOverview: vi.fn(),
    changeSeriesVisibility: vi.fn(),
    grantAccessAndDropDemoProgress: vi.fn(),
    revokeAccess: vi.fn(),
};
vi.mock("@/lib/admin/accessControlService", () => service);

const {
    getSeriesAccessOverviewAction,
    grantSeriesAccessAction,
    revokeSeriesAccessAction,
    setSeriesVisibilityAction,
} = await import("../accessControlActions");

const ADMIN = { id: 1, username: "kacper", email: "a@b.pl", role: "admin" as const, onboardedAt: null };
const VIEWER = { id: 2, username: "widz", email: "c@d.pl", role: "viewer" as const, onboardedAt: null };

beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue(ADMIN);
    service.getSeriesAccessOverview.mockResolvedValue({ users: [], series: [], grants: [] });
    service.grantAccessAndDropDemoProgress.mockResolvedValue({ removedProgressRows: 0 });
});

describe("bramka roli", () => {
    it("brak sesji nie przechodzi do warstwy danych", async () => {
        getSessionUser.mockResolvedValue(null);

        await expect(setSeriesVisibilityAction("Tokyo Ghoul", "public")).resolves.toMatchObject({ kind: "error" });
        await expect(grantSeriesAccessAction("Tokyo Ghoul", 2)).resolves.toMatchObject({ kind: "error" });
        await expect(revokeSeriesAccessAction("Tokyo Ghoul", 2)).resolves.toMatchObject({ kind: "error" });
        await expect(getSeriesAccessOverviewAction()).resolves.toMatchObject({ kind: "error" });

        expect(service.changeSeriesVisibility).not.toHaveBeenCalled();
        expect(service.grantAccessAndDropDemoProgress).not.toHaveBeenCalled();
        expect(service.revokeAccess).not.toHaveBeenCalled();
        expect(service.getSeriesAccessOverview).not.toHaveBeenCalled();
    });

    it("sesja widza nie wystarcza, mimo że akcja jest wywoływalna z zewnątrz", async () => {
        getSessionUser.mockResolvedValue(VIEWER);

        await expect(grantSeriesAccessAction("Tokyo Ghoul", 2)).resolves.toMatchObject({ kind: "error" });
        expect(service.grantAccessAndDropDemoProgress).not.toHaveBeenCalled();
    });
});

describe("zmiana poziomu dostępu", () => {
    it("przyjmuje wyłącznie poziomy zarządzalne z panelu", async () => {
        await expect(setSeriesVisibilityAction("Tokyo Ghoul", "system")).resolves.toMatchObject({ kind: "error" });
        await expect(setSeriesVisibilityAction("Tokyo Ghoul", "cokolwiek")).resolves.toMatchObject({ kind: "error" });
        expect(service.changeSeriesVisibility).not.toHaveBeenCalled();
    });

    it("odrzuca pusty i przesadnie długi klucz serialu", async () => {
        await expect(setSeriesVisibilityAction("", "public")).resolves.toMatchObject({ kind: "error" });
        await expect(setSeriesVisibilityAction("x".repeat(256), "public")).resolves.toMatchObject({ kind: "error" });
        expect(service.changeSeriesVisibility).not.toHaveBeenCalled();
    });

    it("po zapisie unieważnia cache katalogu, bo poziom siedzi w jego payloadzie", async () => {
        await expect(setSeriesVisibilityAction("Tokyo Ghoul", "restricted")).resolves.toMatchObject({ kind: "success" });

        expect(service.changeSeriesVisibility).toHaveBeenCalledWith("Tokyo Ghoul", "restricted");
        expect(updateTag).toHaveBeenCalledWith("catalog");
    });

    it("błąd zapisu nie unieważnia cache", async () => {
        service.changeSeriesVisibility.mockRejectedValue(new Error("db down"));

        await expect(setSeriesVisibilityAction("Tokyo Ghoul", "public")).resolves.toMatchObject({ kind: "error" });
        expect(updateTag).not.toHaveBeenCalled();
    });
});

describe("nadawanie i odbieranie dostępu", () => {
    it("zapisuje, kto nadał uprawnienie", async () => {
        await expect(grantSeriesAccessAction("Tokyo Ghoul", 2)).resolves.toMatchObject({ kind: "success" });
        expect(service.grantAccessAndDropDemoProgress).toHaveBeenCalledWith("Tokyo Ghoul", 2, ADMIN.id);
    });

    it("odrzuca nieprawidłowy identyfikator konta przed dotknięciem bazy", async () => {
        for (const userId of [0, -1, 1.5, "2", null]) {
            await expect(grantSeriesAccessAction("Tokyo Ghoul", userId)).resolves.toMatchObject({ kind: "error" });
            await expect(revokeSeriesAccessAction("Tokyo Ghoul", userId)).resolves.toMatchObject({ kind: "error" });
        }
        expect(service.grantAccessAndDropDemoProgress).not.toHaveBeenCalled();
        expect(service.revokeAccess).not.toHaveBeenCalled();
    });

    it("nadanie dostępu nie unieważnia cache katalogu, bo uprawnienia są poza nim", async () => {
        await grantSeriesAccessAction("Tokyo Ghoul", 2);
        expect(updateTag).not.toHaveBeenCalled();
    });

    it("odebranie dostępu trafia do warstwy danych z tymi samymi argumentami", async () => {
        await expect(revokeSeriesAccessAction("Tokyo Ghoul", 2)).resolves.toMatchObject({ kind: "success" });
        expect(service.revokeAccess).toHaveBeenCalledWith("Tokyo Ghoul", 2);
    });
});
