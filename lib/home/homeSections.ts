import "server-only";
import { cache } from "react";
import { getCatalog } from "@/lib/catalog/catalog";
import {
    planHomeSections,
    readyHomeRows,
    type HomeSectionId,
    type HomeSectionRow,
} from "@/lib/home/homeLayout";
import { getPersonalizedHomeRows } from "@/lib/home/personalizedHomeRows";
import { getPublicHomeRows } from "@/lib/home/publicHomeRows";

const loadHomeRowSections = async (): Promise<ReadonlyMap<HomeSectionId, HomeSectionRow>> => {
    try {
        const catalogResult = await getCatalog();
        const catalog = catalogResult.kind === "error" ? [] : catalogResult.data;
        const [publicRows, personalizedRows] = await Promise.all([
            getPublicHomeRows(catalog),
            getPersonalizedHomeRows(catalog),
        ]);
        const sections = planHomeSections(readyHomeRows([...publicRows, ...personalizedRows]));

        return new Map(sections.map((section) => [section.id, section]));
    } catch (error) {
        console.error("getHomeRowSections failed:", error);
        return new Map();
    }
};

export const getHomeRowSections = cache(loadHomeRowSections);
