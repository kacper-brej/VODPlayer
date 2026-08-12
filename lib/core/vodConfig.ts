import { cookies } from "next/headers";

export const CATALOG_TAG = "catalog";
export const CATALOG_REVALIDATE_SECONDS = 30;

export const PROFILE_COOKIE = "nx_profile";

export const selectedProfileId = async (): Promise<string | null> => {
    const store = await cookies();
    return store.get(PROFILE_COOKIE)?.value ?? null;
};
