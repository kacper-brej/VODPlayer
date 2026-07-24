"use client"
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import saveProgressAction from "@/lib/saveProgressAction";
import PlayerErrorBoundary from "@/components/video/PlayerErrorBoundary";

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
    currentEpisode: number;
    totalEpisodes: number;
    folderName: string;
    fileName: string;
    startTime: number;
}

const WatchClient = ({ videoSrc, title, seriesId, currentEpisode, totalEpisodes, folderName, fileName, startTime }: WatchClientProps) => {
    const router = useRouter();
    const [playerInstanceKey, setPlayerInstanceKey] = useState(0);
    const isNavigatingRef = useRef(false);

    useEffect(() => {
        isNavigatingRef.current = false;
    }, [fileName]);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            if (event.message?.includes("setAttribute") && event.filename?.includes("vidstack")) {
                event.preventDefault();
            }
        };
        window.addEventListener('error', handleGlobalError);
        return () => window.removeEventListener('error', handleGlobalError);
    }, []);

    const handleProgressUpdate = async (currentTime:number) => {
        const currentProfile = "Kacper"
        await saveProgressAction(currentTime, folderName, fileName, currentProfile);
    };

    const handleNextEpisode = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        if (currentEpisode < totalEpisodes) {
            const nextEp = currentEpisode + 1;
            router.replace(`/watch?id=${seriesId}&ep=${nextEp}`);
        } else {
            router.replace(`/series/${seriesId}`);
        }
    }

    const handlePreviousEpisode = () => {
        if (isNavigatingRef.current) return;
        isNavigatingRef.current = true;

        router.replace(`/watch?id=${seriesId}&ep=${currentEpisode - 1}`);
    }

    const handleBack = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        router.back();
    }

    return (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col w-screen h-screen">

            <div className="absolute top-6 left-6 z-50">
                <button onClick={handleBack} className="text-foreground bg-white/10 p-2 rounded-full hover:bg-white/20 cursor-pointer transition-colors">
                    <ArrowLeft size={22} />
                </button>
            </div>

            <div className="flex-1 w-full h-full flex items-center justify-center">
                <PlayerErrorBoundary key={playerInstanceKey} onRetry={() => setPlayerInstanceKey((k) => k + 1)}>
                    <VideoPlayer
                        src={videoSrc}
                        title={title}
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