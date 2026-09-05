import type { EpisodeChapter } from "@/lib/core/contracts";
import type { PlaybackSource } from "@/lib/player/videoAccess";

export interface WatchData {
    playback: PlaybackSource;
    seriesTitle: string;
    episodeTitle: string;
    seasonNumber: number | null;
    episodeSynopsis: string | null;
    seriesId: number;
    seriesKey: string;
    currentEpisode: number;
    totalEpisodes: number;
    fileName: string;
    startTime: number;
    nextEpisodeTitle?: string;
    chapters: EpisodeChapter[];
    autoplayNext: boolean;
    skipIntroPrompt: boolean;
    defaultVolume: number;
    isDemo?: boolean;
    trackProgress?: boolean;
    partyCode?: string;
    episodeKeys: Array<{ key: string; number: number }>;
    nextEpisodeKey?: string;
    previousEpisodeKey?: string;
}
