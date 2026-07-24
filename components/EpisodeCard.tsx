"use client"
import Image from "next/image"
import {Play, CheckCircle2, FileVideo} from "lucide-react";
import { useRouter } from "next/navigation";
import { WATCHED_THRESHOLD_PERCENT } from "@/lib/watchProgress";

export interface EpisodeProps {
    id: number | string;
    seriesId: number | string;
    episodeNumber: number;
    title: string;
    duration: number | string;
    description: string;
    thumbnail: string; // Poprawiona literówka
    progress?: number;
}

const EpisodeCard = ({seriesId, episodeNumber, title, duration, description, thumbnail, progress}: EpisodeProps) => {
    const router = useRouter();
    const isWatched = progress !== undefined && progress >= WATCHED_THRESHOLD_PERCENT;

    return (
        <div
            onClick={() => router.push(`/watch?id=${seriesId}&ep=${episodeNumber}`)}
            className="group flex flex-col md:flex-row gap-4 p-4 rounded-xl cursor-pointer  bg-surface/20 border border-white/5 hover:bg-surface/60 transition-all duration-300 relative">

            {/*miniaturka*/}
            <div className={`relative w-full md:w-48 aspect-video shrink-0 rounded-lg overflow-hidden bg-background transition-all ${isWatched ? 'opacity-70 ring-2 ring-success/60 shadow-[0_0_20px_-2px_var(--success)]' : ''}`}>
                <Image
                    src={thumbnail}
                    alt={title}
                    fill
                    className='object-cover group-hover:scale-105 transition-transform duration-500'
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"/>

                {isWatched && (
                    <span className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-semibold text-success bg-success/20 backdrop-blur-md border border-success/40 rounded-full px-2.5 py-1">
                        <CheckCircle2 size={12} />
                        Obejrzane
                    </span>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-full border-2 backdrop-blur-sm ${isWatched ? 'border-success/70 bg-success/10 text-success' : 'border-foreground/60 bg-background/30 text-foreground'}`}>
                        <Play size={18} className='fill-current' />
                    </div>
                </div>

                {/* Pasek postępu */}
                {progress !== undefined && progress > 0 && (
                    <div className='absolute bottom-0 left-0 w-full h-1 bg-white/20'>
                        <div className="h-full bg-primary" style={{width: `${progress}%`}}></div>
                    </div>
                )}
            </div>

            {/* tekst */}
            <div className="flex flex-col justify-center py-1">

                <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className='text-xl font-bold text-foreground/50'>
                        {episodeNumber}
                    </span>
                    <h3 className="text-lg font-bold text-foreground">
                        {title}
                    </h3>
                </div>
                <div className='flex items-center gap-1.5 text-xs text-muted font-semibold mb-2'>
                    <FileVideo size={12} />
                    <span>Wideo MP4</span>
                    <span className='text-muted/50'>&middot;</span>
                    <span>{duration}</span>
                </div>
                <p className="text-sm text-foreground/70 line-clamp-2 md:line-clamp-3">
                    {description}
                </p>
            </div>
        </div>
    )
}

export default EpisodeCard;