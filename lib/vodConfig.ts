import { cookies } from "next/headers";

export const VOD_ORIGIN = process.env.NEXT_PUBLIC_VOD_ORIGIN ?? "https://vids.kacper-brej.pl";
export const VOD_SERVICE_KEY = process.env.VOD_SERVICE_KEY ?? process.env.UPLOAD_SECRET ?? "";

export const CATALOG_TAG = "catalog";
export const CATALOG_REVALIDATE_SECONDS = 30;

export const sessionToken = async (): Promise<string | null> => {
    const store = await cookies();
    return store.get("token")?.value ?? null;
};

export const PROFILE_COOKIE = "nx_profile";

export const selectedProfileId = async (): Promise<string | null> => {
    const store = await cookies();
    return store.get(PROFILE_COOKIE)?.value ?? null;
};

export const sessionHeaders = async (): Promise<Record<string, string> | null> => {
    const token = await sessionToken();

    if (!token) return null;

    return {
        "X-Auth-Token": token,
        Authorization: `Bearer ${token}`,
    };
};

export const serviceHeaders = (): HeadersInit => ({ "X-Service-Key": VOD_SERVICE_KEY });
