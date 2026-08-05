import "server-only";
import { createHmac } from "node:crypto";
import { VOD_ORIGIN } from "@/lib/vodConfig";
import {
    validateMediaStatusResponse,
    type MediaStatusResponse,
} from "@/lib/contracts";
import { dataFailure, dataSuccess, failureFromStatus, type DataResult } from "@/lib/dataResult";

const MEDIA_REGISTRY_SIGNATURE_CONTEXT = "nocturna/media-registry/v1";

const mediaRegistrySigningKey = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("Missing JWT_SECRET for media registry status requests");
    }

    return createHmac("sha256", secret).update(MEDIA_REGISTRY_SIGNATURE_CONTEXT).digest();
};

const signMediaRegistryRequest = (timestamp: number, rawBody: string) =>
    createHmac("sha256", mediaRegistrySigningKey()).update(`${timestamp}\n${rawBody}`).digest("hex");

export const getMediaStorageStatus = async (): Promise<DataResult<MediaStatusResponse>> => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signMediaRegistryRequest(timestamp, "");

    try {
        const response = await fetch(`${VOD_ORIGIN}/media-status.php`, {
            headers: {
                "X-Nocturna-Timestamp": String(timestamp),
                "X-Nocturna-Signature": signature,
            },
            cache: "no-store",
        });

        if (!response.ok) return failureFromStatus(response.status);

        const result = validateMediaStatusResponse(await response.json());

        if (!result.ok) {
            console.error(result.error);
            return dataFailure("invalid_response");
        }

        return dataSuccess(result.data);
    } catch (error) {
        console.error("Media storage status request failed:", error);
        return dataFailure("network");
    }
};
