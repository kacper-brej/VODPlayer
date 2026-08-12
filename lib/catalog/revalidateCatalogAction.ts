"use server";

import { updateTag } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { CATALOG_TAG } from "@/lib/core/vodConfig";

const revalidateCatalogAction = async (): Promise<{ success: boolean }> => {
    const user = await getSessionUser();

    if (!user || user.role !== "admin") return { success: false };

    updateTag(CATALOG_TAG);

    return { success: true };
};

export default revalidateCatalogAction;
