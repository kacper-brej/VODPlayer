import {Play, Plus} from "lucide-react"
import Image from "next/image"

export interface SeriesHeroProps {
    title: string,
    description: string,
    coverImage: string,
    year: number,
    rating: string,
    sesonsCount: number,
    genres: string[],
}

const seriesHero = ({title, description, coverImage, year, rating, sesonsCount, genres}: SeriesHeroProps) =>{
    return (
        <>
            <div className={`relative w-full h-[60vh] md:h-[70vh] flex items-end`}>
                <div className="absolute inset-0 w-full h-full">
                    <Image
                        src={coverImage}
                        alt={title}
                        fill
                    />
                </div>
                <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent z-10" />
                <div className="absolute inset-0 bg-linear-to-r from-background via-background/60 to-transparent z-10 md:w-[70%]" />
                <div className="relative z-20 w-full max-w-4xl px-4 md:px-8 pb-12">
                    <h1 className='text-4xl md:text-6xl font-extrabold text-foreground mb-4 drop-shadow-xl'>
                        {title}
                    </h1>
                {/*  METADANE  */}
                    <div className="flex items-center gap-4 text-sm md:text-base text-muted font-medium mb-6">
                        <span className="text-succes font-semibold">{year}</span>
                        <span className="px-2 py-1/2 border border-white/20 rounded-md bg-white/5 backdrop-blur-sm text-xs">{rating}</span>
                        <span>{sesonsCount} {sesonsCount === 1 ? 'Sezon' : 'Sezony'}</span>
                        {genres.map((genre:string, i:number) => (
                            <span key={i} className='flex items-center'>
                                <span className='max-md:hidden md:inline-block w-1 h-1 bg-white/30 rounded-full mx-2'>
                                    {genre}
                                </span>
                            </span>
                        ))}

                    </div>
                </div>
                <p className="text-foreground/80 text-sm md:text-base line-clamp-3 md:line-clamp-4 max-w-2xl mb-8">
                    {description}
                </p>
                <div className="flex items-center gap-4">
                    <button className='flex items-center gap-2 px-6 py-3 bg-foreground text-background font-bold rounded-xl
                     hover:bg-white/80 transition-colors duration-300'>
                        <Play size={20} className='fill-background'/>
                        Odtwórz
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-surface/50 text-foreground font-bold rounded-xl border
                    border-white/10 hover:bg-surface hover:border-white/30 backdrop-blur-md transition-all duration-300">
                        <Plus size={20}/>
                        Moja lista
                    </button>
                </div>
            </div>
        </>
    )
}
export default seriesHero;