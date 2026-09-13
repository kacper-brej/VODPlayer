import type { SeriesDetails } from "@/lib/catalog/getSeriesDetailsAction";
import { dataFailure, type DataResult } from "@/lib/core/dataResult";

export const loadSeriesDetails = async (
    id: number,
    enrichMetadata: boolean,
    signal: AbortSignal,
): Promise<DataResult<SeriesDetails | null>> => {
    try {
        const response = await fetch(`/api/series/details?id=${id}`, {
            method: enrichMetadata ? "POST" : "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal,
        });
        if (!response.ok) {
            return dataFailure(response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "server", response.status);
        }
        const result: DataResult<SeriesDetails | null> = await response.json();
        if (result?.kind !== "success" && result?.kind !== "empty" && result?.kind !== "error") {
            return dataFailure("invalid_response");
        }
        return result;
    } catch {
        return dataFailure("network");
    }
};
