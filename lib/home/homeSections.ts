import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog/catalog";
import {
    HOME_SECTION_ORDER,
    getHomeSectionDependencies,
    planHomeSections,
    type HomeSectionId,
    type HomeSectionRow,
} from "@/lib/home/homeLayout";
import type { HomeRowPromises } from "@/lib/home/homeRowTypes";
import { startPersonalizedHomeRows } from "@/lib/home/personalizedHomeRows";
import { startPublicHomeRows } from "@/lib/home/publicHomeRows";

export const createHomeSectionPromises = (
    rows: HomeRowPromises,
): ReadonlyMap<HomeSectionId, Promise<HomeSectionRow | undefined>> => {
    const readyRows = new Map<HomeSectionId, Promise<HomeSectionRow | undefined>>(
        [...rows].map(([id, result]) => [id, result
            .then((value) => value.kind === "ready" ? value.row : undefined)
            .catch((error) => {
                console.error("getHomeRowSection failed:", error);
                return undefined;
            })]),
    );
    const sections = new Map<HomeSectionId, Promise<HomeSectionRow | undefined>>();

    for (const id of HOME_SECTION_ORDER) {
        const row = readyRows.get(id);
        if (!row) continue;

        const dependencies = getHomeSectionDependencies(id).map((previous) => readyRows.get(previous));
        sections.set(id, Promise.all([...dependencies, row]).then((resolved) =>
            planHomeSections(resolved.filter((value): value is HomeSectionRow => value !== undefined))
                .find((section) => section.id === id),
        ));
    }

    return sections;
};

const getHomeSectionPromises = cache(async () => {
    try {
        const user = await getSessionUser();
        if (!user) return new Map<HomeSectionId, Promise<HomeSectionRow | undefined>>();

        const catalog = getCatalog(false)
            .then((result) => result.kind === "error" ? [] : result.data);
        return createHomeSectionPromises(new Map([
            ...startPublicHomeRows(catalog),
            ...startPersonalizedHomeRows(catalog),
        ]));
    } catch (error) {
        console.error("getHomeRowSections failed:", error);
        return new Map<HomeSectionId, Promise<HomeSectionRow | undefined>>();
    }
});

export const preloadHomeRowSections = async (): Promise<void> => {
    const sections = await getHomeSectionPromises();
    await Promise.allSettled(sections.values());
};

export const getHomeRowSection = async (id: HomeSectionId): Promise<HomeSectionRow | undefined> =>
    (await getHomeSectionPromises()).get(id);

export const getHomeRowSections = cache(async (): Promise<ReadonlyMap<HomeSectionId, HomeSectionRow>> => {
    const sections = await Promise.all((await getHomeSectionPromises()).values());

    return new Map(sections
        .filter((section): section is HomeSectionRow => section !== undefined)
        .map((section) => [section.id, section]));
});
