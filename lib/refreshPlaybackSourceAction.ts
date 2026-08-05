"use server";

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getCatalogSeriesByKey } from "@/lib/catalog";
import { resolvePlaybackSource, type PlaybackSource } from "@/lib/videoAccess";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/dataResult";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

const hasValidSessionCookie = async (): Promise<boolean> => {
    const token = (await cookies()).get("token")?.value;

    if (!token) return false;

    try {
        await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
        return true;
    } catch {
        return false;
    }
};

const refreshPlaybackSourceAction = async (
    seriesKey: string,
    episodeKey: string,
): Promise<DataResult<PlaybackSource>> => {
    if (!(await hasValidSessionCookie())) {
        return dataFailure("unauthorized", 401);
    }

    const seriesResult = await getCatalogSeriesByKey(seriesKey);

    if (seriesResult.kind === "error") return seriesResult;
    if (!seriesResult.data) return dataFailure("invalid_response");

    const episode = seriesResult.data.episodes.find((item) => item.key === episodeKey);

    if (!episode) return dataFailure("invalid_response");

    return dataSuccess(resolvePlaybackSource(seriesKey, episode));
};

export default refreshPlaybackSourceAction;
