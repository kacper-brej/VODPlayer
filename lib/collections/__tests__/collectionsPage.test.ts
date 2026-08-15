import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("collections page", () => {
    it("czyta kolekcje użytkownika zamiast grup sezonów katalogu", () => {
        const page = source("app/(app)/collections/page.tsx");
        const catalog = source("components/series/CatalogScreen.tsx");

        expect(page).toContain("getCollections()");
        expect(page).toContain("getCollection(collectionId)");
        expect(page).not.toContain('mode="collections"');
        expect(catalog).not.toContain('mode === "collections"');
    });

    it("mapuje zapisane klucze na istniejące karty katalogu", () => {
        const page = source("app/(app)/collections/page.tsx");

        expect(page).toContain("collectionResult.data.items.flatMap");
        expect(page).toContain("toContentCard(series");
        expect(page).toContain("CatalogGrid");
        expect(page).toContain("DataErrorState");
    });

    it("udostępnia pełne zarządzanie przez zabezpieczone akcje serwerowe", () => {
        const page = source("app/(app)/collections/page.tsx");
        const manager = source("components/collections/CollectionManager.tsx");
        const actions = source("lib/collections/collectionsActions.ts");

        expect(page).toContain("CreateCollectionForm");
        expect(page).toContain("CollectionControls");
        expect(page).toContain("RemoveFromCollectionButton");
        expect(manager).toContain("createCollectionAction(name)");
        expect(manager).toContain("renameCollectionAction(collectionId, name)");
        expect(manager).toContain("deleteCollectionAction(collectionId)");
        expect(manager).toContain("addToCollectionAction(collectionId, selectedSeries)");
        expect(manager).toContain("removeFromCollectionAction(collectionId, seriesKey)");
        expect(actions).toContain('revalidatePath("/collections")');
    });
});
