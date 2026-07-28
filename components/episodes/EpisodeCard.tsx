"use client"
import Image from "next/image";
import { Play, FileVideo, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { WATCHED_THRESHOLD_PERCENT } from "@/lib/watchProgress";
import { watchPath } from "@/lib/routes";

export interface EpisodeProps {
    id: number | string;
    seriesId: number | string;
    episodeNumber: number;
    title: string;
    duration: number | string;
    description: string;
    thumbnail: string;
    progress?: number;
}

const EpisodeCard = ({ seriesId, episodeNumber, thumbnail, progress }: EpisodeProps) => {
    const router = useRouter();
    const isWatched = progress !== undefined && progress >= WATCHED_THRESHOLD_PERCENT;

    const goToEpisode = () => router.push(watchPath(seriesId, episodeNumber));

    return (
        <div className="flex flex-col gap-2 w-full">
            <div
                onClick={goToEpisode}
                className={`group relative aspect-video w-full rounded-lg md:rounded-xl overflow-hidden bg-surface border border-white/5 hover:border-border-hover cursor-pointer transition-colors ${isWatched ? 'ring-2 ring-success/50' : ''}`}
            >
                <Image
                    src={thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/20 pointer-events-none" />

                {isWatched && (
                    <span className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[9px] md:text-[10px] font-semibold text-success bg-success/20 backdrop-blur-md border border-success/40 rounded-full px-2 py-0.5">
                        <CheckCircle2 size={10} />
                        Obejrzane
                    </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-11 h-11 md:w-14 md:h-14 flex items-center justify-center rounded-full border-2 backdrop-blur-sm transition-all group-hover:scale-105 ${isWatched ? 'border-success/70 bg-success/10 text-success' : 'border-foreground/70 bg-black/25 text-foreground group-hover:bg-primary/40 group-hover:border-primary'}`}>
                        <Play size={18} className="fill-current ml-0.5 md:w-5 md:h-5" />
                    </div>
                </div>

                {progress !== undefined && progress > 0 && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-10">
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-0.5 px-0.5">
                <span className="text-sm md:text-base font-bold text-foreground">
                    {episodeNumber}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] md:text-xs uppercase tracking-wide text-muted font-semibold">
                    <FileVideo size={12} />

                </span>
            </div>
        </div>
    )
}

export default EpisodeCard;
