"use server";
import { updateTag } from "next/cache";
import { CATALOG_TAG, VOD_ORIGIN, VOD_SERVICE_KEY, sessionToken } from "@/lib/vodConfig";

const revalidateCatalogAction = async () => {
    const token = await sessionToken();

    if (!token) return { success: false };

    try {
        await fetch(`${VOD_ORIGIN}/catalog.php?force=1`, {
            headers: { "X-Service-Key": VOD_SERVICE_KEY },
            cache: "no-store",
        });
    } catch (error) {
        console.error("catalog force refresh failed", error);
    }

    updateTag(CATALOG_TAG);

    return { success: true };
};

export default revalidateCatalogAction;
