"use client";

import dynamic from "next/dynamic";
import { loadHlsLibrary } from "@/lib/player/loadHlsLibrary";

export const preloadVideoPlayer = (hls: boolean) => Promise.all([
    import("./VideoPlayer"),
    hls ? loadHlsLibrary() : Promise.resolve(),
]);

const LazyVideoPlayer = dynamic(() => import("./VideoPlayer").then((mod) => mod.VideoPlayer), {
    ssr: false,
    loading: () => (
        <div className="np-player-loading" role="status">
            <span className="np-player-loading-ring" />
            <span>Ładowanie odtwarzacza</span>
        </div>
    ),
});

export default LazyVideoPlayer;
