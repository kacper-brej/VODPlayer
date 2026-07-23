"use client"
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Play, Plus, ThumbsUp, ChevronDown } from "lucide-react";

export interface SeriesCardProps {
    id: number;
    title: string;
    coverImage: string;
    rating?: string;
    year?: number;
}

const SeriesCard = ({ id, title, coverImage, rating = "16+", year }: SeriesCardProps) => {

    const router = useRouter();

    const handleCardClick = () => {
        router.push(`/series/${id}`);
    }

    const handleInfoClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`?info=${id}`, {scroll: false});
    }
    const handleAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        console.log('building');
        // zrob ta funkcje pozniej
    }

    return (
        <div
            onClick={handleCardClick}
            className='relative w-full h-full cursor-pointer bg-zinc-900 group'
        >
            <Image
                src={coverImage}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 70vw, 22vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-zinc-950 via-zinc-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 md:p-4">

                <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow-md line-clamp-1 mb-3">
                    {title}
                </h3>

                <div className="flex items-center justify-between w-full mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/watch?id=${id}&ep=1`); }}
                            className="w-7 h-7 md:w-9 md:h-9 bg-white cursor-pointer rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                        >
                            <Play size={16} className="fill-black text-black ml-0.5" />
                        </button>

                        <button
                            onClick={handleAction}
                            className="w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer border-gray-400 rounded-full flex items-center justify-center hover:border-white
                            bg-zinc-900/50 hover:bg-zinc-800 transition-all text-white"
                        >
                            <Plus size={16} />
                        </button>

                        <button
                            onClick={handleAction}
                            className="w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer rounded-full flex items-center justify-center hover:border-white bg-zinc-900/50
                            hover:bg-zinc-800 transition-all text-white"
                        >
                            <ThumbsUp size={14} />
                        </button>
                    </div>

                    <button
                        onClick={handleInfoClick}
                        className="w-7 h-7 md:w-9 md:h-9 border-2 cursor-pointer border-gray-400 rounded-full flex items-center justify-center hover:border-white
                        bg-zinc-900/50 hover:bg-zinc-800 transition-all text-white"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-white font-medium mb-1.5">
                    <span className="border border-gray-400 px-1 py-0.5 text-gray-200">
                        {rating === "NR" ? "16+" : rating}
                    </span>
                    {year && (
                        <span className="text-gray-300">
                            {year}
                        </span>
                    )}
                    <span className="border border-gray-400 px-1 py-0.5 text-gray-200 text-[8px] md:text-[10px] rounded-sm font-bold">
                        HD
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] md:text-[11px] text-gray-300 font-medium line-clamp-1">
                    <span>Anime</span>
                    <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                    <span>Akcja</span>
                    <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                    <span>Dramat</span>
                </div>
            </div>
        </div>
    );
};

export default SeriesCard;