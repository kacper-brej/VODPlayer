"use client"
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import saveProgressAction from "@/lib/saveProgressAction";
import PlayerErrorBoundary from "@/components/video/PlayerErrorBoundary";
import { seriesPath, watchPath } from "@/lib/routes";

const VideoPlayer = dynamic(
    () => import("@/components/video/VideoPlayer").then((mod) => mod.VideoPlayer),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        ),
    }
);

interface WatchClientProps {
    videoSrc: string;
    title: string;
    seriesId: number;
    seriesKey: string;
    currentEpisode: number;
    totalEpisodes: number;
    fileName: string;
    startTime: number;
    nextEpisodeTitle?: string;
}

const WatchClient = ({ videoSrc, title, seriesId, seriesKey, currentEpisode, totalEpisodes, fileName, startTime, nextEpisodeTitle }: WatchClientProps) => {
    const router = useRouter();
    const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
    const isNavigatingRef = useRef(false);

    useEffect(() => {
        isNavigatingRef.current = false;
    }, [fileName]);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            const isVidstackNoise = event.filename?.includes("vidstack") && (
                event.message?.includes("setAttribute") || event.message?.includes("$state[prop]")
            );
            if (isVidstackNoise) {
                event.preventDefault();
            }
        };
        window.addEventListener('error', handleGlobalError);
        return () => window.removeEventListener('error', handleGlobalError);
    }, []);

    const handleProgressUpdate = async (currentTime: number, duration: number) => {
        await saveProgressAction({
            seriesKey,
            episodeKey: fileName,
            positionSeconds: currentTime,
            durationSeconds: duration,
        });
    };

    const handleNextEpisode = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        if (currentEpisode < totalEpisodes) {
            const nextEp = currentEpisode + 1;
            router.replace(watchPath(seriesId, nextEp));
        } else {
            router.replace(seriesPath(seriesId));
        }
    }

    const handlePreviousEpisode = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        router.replace(watchPath(seriesId, currentEpisode - 1));
    }

    const handleBack = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        router.back();
    }

    return (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col w-screen h-screen">

            <div className="flex-1 w-full h-full flex items-center justify-center">
                <PlayerErrorBoundary key={playerInstanceKey} onRetry={() => setPlayerInstanceKey((k) => k + 1)}>
                    <VideoPlayer
                        src={videoSrc}
                        title={title}
                        subtitle={`Odcinek ${currentEpisode} z ${totalEpisodes}`}
                        episodesLeft={Math.max(0, totalEpisodes - currentEpisode)}
                        nextEpisodeTitle={nextEpisodeTitle}
                        onBack={handleBack}
                        onNextEpisode={handleNextEpisode}
                        onPreviousEpisode={currentEpisode > 1 ? handlePreviousEpisode : undefined}
                        onProgressUpdate={handleProgressUpdate}
                        startTime={startTime}
                    />
                </PlayerErrorBoundary>
            </div>

        </div>
    )
}

export default WatchClient;
