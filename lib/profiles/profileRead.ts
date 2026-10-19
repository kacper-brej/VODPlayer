import "server-only";
import { cache } from "react";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";
import { reuseRequestRead } from "@/lib/http/requestReadScope";

export const resolveOwnedProfileIdForRead = cache((userId: number, username: string) =>
    reuseRequestRead(`owned-profile:${userId}`, () => resolveOwnedProfileId(userId, username)));
