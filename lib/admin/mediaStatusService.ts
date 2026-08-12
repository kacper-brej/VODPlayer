import "server-only";
import type { MediaStatusResponse } from "@/lib/core/contracts";
import { listMediaAssetsWithRenditions, getLastVerificationRun } from "@/lib/admin/mediaStatusRepository";

export const getMediaStatus = async (): Promise<MediaStatusResponse> => {
    const [assets, lastVerification] = await Promise.all([
        listMediaAssetsWithRenditions(),
        getLastVerificationRun(),
    ]);
    return { assets, lastVerification };
};
