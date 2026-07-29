"use server";
import { VOD_ORIGIN, sessionHeaders } from "@/lib/vodConfig";
import { validateUploadTokenResponse, type UploadTokenResponse } from "@/lib/contracts";
import {
    dataFailure,
    dataSuccess,
    failureFromStatus,
    type DataResult,
} from "@/lib/dataResult";

const getUploadTokenAction = async (
    folder: string,
    episodeNumber: number,
): Promise<DataResult<UploadTokenResponse>> => {
    const headers = await sessionHeaders();

    if (!headers) return dataFailure("unauthorized", 401);

    try {
        const res = await fetch(`${VOD_ORIGIN}/upload-token.php`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ folder, episodeNumber }),
        });

        if (!res.ok) return failureFromStatus(res.status);

        const payload: unknown = await res.json();
        const result = validateUploadTokenResponse(payload);

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("Upload token request failed:", error);
        return dataFailure("network");
    }
};

export default getUploadTokenAction;
