import "server-only";
import { cache } from "react";
import { resolveOwnedProfileId } from "@/lib/profiles/profileService";

export const resolveOwnedProfileIdForRead = cache(resolveOwnedProfileId);
