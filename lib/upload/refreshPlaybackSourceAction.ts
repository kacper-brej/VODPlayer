"use server";

import { playbackSourceFromAsset, type PlaybackSource } from "@/lib/player/videoAccess";
import { findReadyHlsAssetByMediaKey } from "@/lib/player/hlsRepository";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { getSessionUser } from "@/lib/auth/session";

const refreshPlaybackSourceAction = async (
    seriesKey: string,
    episodeKey: string,
): Promise<DataResult<PlaybackSource>> => {
    if (!(await getSessionUser())) {
        return dataFailure("unauthorized", 401);
    }

    const asset = await findReadyHlsAssetByMediaKey(seriesKey, episodeKey);
    if (!asset) return dataFailure("invalid_response");

    return dataSuccess(playbackSourceFromAsset(
        asset.id,
        asset.version,
        seriesKey,
        episodeKey,
        asset.renditions.map((rendition) => rendition.height),
    ));
};

export default refreshPlaybackSourceAction;
