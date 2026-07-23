"use client"
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import saveProgressAction from "@/lib/saveProgressAction";

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

    const handleProgressUpdate = async (currentTime:number) => {
        const currentProfile = "Kacper"
        await saveProgressAction(currentTime, folderName, fileName, currentProfile);
    };

    const handleNextEpisode = () => {
        if (currentEpisode < totalEpisodes) {
            const nextEp = currentEpisode + 1;
            router.replace(`/watch?id=${seriesId}&ep=${nextEp}`);
        } else {
            router.replace(`/series/${seriesId}`);
        }
    }

    return (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col w-screen h-screen">

            <div className="absolute top-6 left-6 z-50">
                <button onClick={() => router.back()} className="text-white bg-white/10 p-2 rounded-full hover:bg-white/20">
                    Wróć
                </button>
            </div>

            <div className="flex-1 w-full h-full flex items-center justify-center">
                <VideoPlayer
                    src={videoSrc}
                    title={title}
                    onNextEpisode={handleNextEpisode}
                    onProgressUpdate={handleProgressUpdate}
                    startTime={startTime}
                />
            </div>

        </div>
    )
}

export default WatchClient;