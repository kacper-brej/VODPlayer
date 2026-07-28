"use server";
import { updateTag } from "next/cache";
import { CATALOG_TAG, VOD_ORIGIN, VOD_SERVICE_KEY, sessionToken } from "@/lib/vodConfig";
import { validateCatalogResponse } from "@/lib/contracts";

const revalidateCatalogAction = async () => {
    const token = await sessionToken();

    if (!token) return { success: false };

    try {
        const response = await fetch(`${VOD_ORIGIN}/catalog.php?force=1`, {
            headers: { "X-Service-Key": VOD_SERVICE_KEY },
            cache: "no-store",
        });

        if (!response.ok) {
            console.error("Catalog refresh failed:", response.status);
            return { success: false };
        }

        const payload: unknown = await response.json();
        const result = validateCatalogResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return { success: false };
        }
    } catch (error) {
        console.error("Catalog refresh failed:", error);
        return { success: false };
    }

    updateTag(CATALOG_TAG);

    return { success: true };
};

export default revalidateCatalogAction;
