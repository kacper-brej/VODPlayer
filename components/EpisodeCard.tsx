"use client"
import Image from "next/image"
import {Play} from "lucide-react";
import { useRouter } from "next/navigation";

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
    return (
        <div
            onClick={() => router.push(`/watch?id=${seriesId}&ep=${episodeNumber}`)}
            className="group flex flex-col md:flex-row gap-4 p-4 rounded-xl cursor-pointer  bg-surface/20 border border-white/5 hover:bg-surface/60 transition-all duration-300 relative">

            {/*miniaturka*/}
            <div className="relative w-full md:w-48 aspect-video shrink-0 rounded-lg overflow-hidden bg-background">
                <Image
                    src={thumbnail}
                    alt={title}
                    fill
                    className='object-cover group-hover:scale-105 transition-transform duration-500'
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"/>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2 bg-background/80 rounded-full backdrop-blur-md">
                        <Play size={20} className='fill-foreground' />
                    </div>
                </div>

                {/* Pasek postępu */}
                {progress !== undefined && (
                    <div className='absolute bottom-0 left-0 w-full h-1 bg-white/20'>
                        <div className="h-full bg-primary" style={{width: `${progress}%`}}></div>
                    </div>
                )}
            </div>

            {/* tekst */}
            <div className="flex flex-col justify-center py-1">

                <div className="flex items-center gap-3 mb-2">
                    <span className='text-xl font-bold text-foreground/50'>
                        {episodeNumber}
                    </span>
                    <h3 className="text-lg font-bold text-foreground">
                        {title}
                    </h3>
                </div>
                <p className='text-xs text-muted font-semibold mb-2'>
                    {duration}
                </p>
                <p className="text-sm text-foreground/70 line-clamp-2 md:line-clamp-3">
                    {description}
                </p>
            </div>
        </div>
    )
}

export default EpisodeCard;