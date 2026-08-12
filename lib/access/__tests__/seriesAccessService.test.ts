import { describe, expect, it } from "vitest";
import type { SeriesVisibility } from "@/lib/core/contracts";
import {
    canStream,
    isCatalogVisible,
    normalizeVisibility,
    resolveEntitlements,
    resolveSeriesAccess,
} from "@/lib/access/seriesAccessService";

describe("poziom dostępu do serialu", () => {
    it("brak wiersza w series_access znaczy restricted, nie public", () => {
        expect(normalizeVisibility(undefined)).toBe("restricted");
        expect(normalizeVisibility(null)).toBe("restricted");
        expect(resolveSeriesAccess({ role: "viewer", visibility: null, hasGrant: false })).toBe("demo");
    });

    it("public gra dla każdego zalogowanego widza", () => {
        expect(resolveSeriesAccess({ role: "viewer", visibility: "public", hasGrant: false })).toBe("full");
    });

    it("restricted wymaga jawnego uprawnienia", () => {
        expect(resolveSeriesAccess({ role: "viewer", visibility: "restricted", hasGrant: false })).toBe("demo");
        expect(resolveSeriesAccess({ role: "viewer", visibility: "restricted", hasGrant: true })).toBe("full");
    });

    it("poziom admin nie otwiera się na uprawnienie widza", () => {
        expect(resolveSeriesAccess({ role: "viewer", visibility: "admin", hasGrant: true })).toBe("demo");
    });

    it("admin ma pełny dostęp niezależnie od poziomu i uprawnień", () => {
        const levels: SeriesVisibility[] = ["public", "restricted", "admin", "system"];
        for (const visibility of levels) {
            expect(resolveSeriesAccess({ role: "admin", visibility, hasGrant: false })).toBe("full");
        }
    });

    it("brak roli jest traktowany jak widz", () => {
        expect(resolveSeriesAccess({ role: undefined, visibility: "restricted", hasGrant: false })).toBe("demo");
        expect(resolveSeriesAccess({ role: undefined, visibility: "public", hasGrant: false })).toBe("full");
    });
});

describe("materiał techniczny", () => {
    it("poziom system nie trafia do katalogu", () => {
        expect(isCatalogVisible("system")).toBe(false);
        expect(isCatalogVisible("restricted")).toBe(true);
        expect(isCatalogVisible(null)).toBe(true);
    });

    it("poziom system jest odtwarzalny dla sesji, choć nie daje pełnego dostępu do tytułu", () => {
        const input = { role: "viewer" as const, visibility: "system" as const, hasGrant: false };
        expect(resolveSeriesAccess(input)).toBe("demo");
        expect(canStream(input)).toBe(true);
    });

    it("strumień chronionego tytułu bez uprawnienia jest zamknięty", () => {
        expect(canStream({ role: "viewer", visibility: "restricted", hasGrant: false })).toBe(false);
        expect(canStream({ role: "viewer", visibility: "restricted", hasGrant: true })).toBe(true);
        expect(canStream({ role: "viewer", visibility: "admin", hasGrant: true })).toBe(false);
    });
});

describe("zbiór uprawnień widza", () => {
    const visibility = new Map<string, SeriesVisibility>([
        ["Tokyo Ghoul", "restricted"],
        ["Big Buck Bunny", "public"],
        ["Kulisy", "admin"],
        ["_demo", "system"],
    ]);
    const keys = ["Tokyo Ghoul", "Big Buck Bunny", "Kulisy", "_demo", "Nowy tytuł"];

    it("widz z jednym uprawnieniem dostaje wyłącznie ten tytuł i tytuły publiczne", () => {
        const entitled = resolveEntitlements("viewer", visibility, ["Tokyo Ghoul"], keys);
        expect([...entitled].sort()).toEqual(["Big Buck Bunny", "Tokyo Ghoul"]);
    });

    it("tytuł bez wpisu widoczności nie wchodzi do zbioru", () => {
        const entitled = resolveEntitlements("viewer", visibility, [], keys);
        expect(entitled.has("Nowy tytuł")).toBe(false);
    });

    it("admin dostaje wszystko, co przekazano", () => {
        const entitled = resolveEntitlements("admin", visibility, [], keys);
        expect(entitled.size).toBe(keys.length);
    });
});
