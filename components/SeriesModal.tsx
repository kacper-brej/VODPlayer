"use client"
import {useRouter, useSearchParams} from "next/navigation"
import {useEffect, useState} from "react"
import {fetchMovieInfo} from "@/lib/fetchMovieInfo";
import {Episode} from "@/lib/fetchMovieInfo";
import {X, Play} from 'lucide-react'
import Image from "next/image";

const SeriesModal = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const movieId = searchParams.get("info");

    const [movieData, setMovieData] = useState<any>(null)
    const [episodes, setEpisodes] = useState<Episode[]>([])
    const [loading, setLoading] = useState(false)
    const [showAnimation, setShowAnimation] = useState(false)

    const closeModal = () => {
        setShowAnimation(false);
        setTimeout(() => {
            router.push("/", {scroll:false})
        }, 200);
    }

    useEffect(() => {
        if(!movieId) return;

        setTimeout(() => setShowAnimation(true), 10);

        const loadMovieData = async () => {
            setLoading(true);
            const data = await fetchMovieInfo(Number(movieId));
            setMovieData(data.details);
            setEpisodes(data.episodes);
            setLoading(false);
        }

        void loadMovieData();

    }, [movieId]);

    if (!movieId) return null;

    return (
        <div
            onClick={closeModal}
            className={`fixed inset-0 z-50 flex items-start pt-0 md:pt-[5vh] justify-center bg-background/90 p-0 md:p-4 transition-opacity duration-200 ease-out ${showAnimation ? "opacity-100" : "opacity-0"}`}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-h-dvh md:max-h-[90vh] md:max-w-4xl bg-surface md:rounded-xl shadow-2xl overflow-y-auto scrollbar-hide transition-all duration-200 ease-out ${showAnimation ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-8"}`}
            >
                <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 z-50 w-8 h-8 md:w-10 md:h-10 bg-surface-light/80 hover:bg-primary text-foreground rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm"
                >
                    <X size={20} className='md:w-6 md:h-6'/>
                </button>

                {loading ? (
                    <div className="text-foreground pb-8 w-full">
                        <div className="w-full h-62.5 md:h-100 shrink-0 bg-surface-light animate-pulse relative">
                            <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
                        </div>
                        <div className="px-4 md:px-8 mt-4 relative z-10">
                            <div className="h-8 md:h-10 bg-surface-light/60 animate-pulse rounded-md w-2/3 mb-4"></div>
                            <div className="space-y-3 mb-8">
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-full"></div>
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-5/6"></div>
                                <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-4/6"></div>
                            </div>
                            <div className="h-6 bg-surface-light/60 animate-pulse rounded-md w-32 mb-4"></div>
                            <div className="flex flex-col gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className='flex items-center gap-4 p-3 md:p-4 bg-surface-light/30 rounded-lg border border-border'>
                                        <div className="relative w-32 h-20 md:w-40 md:h-24 shrink-0 rounded-md bg-surface-light/60 animate-pulse"></div>
                                        <div className="flex flex-col flex-1 gap-3">
                                            <div className="h-4 bg-surface-light/50 animate-pulse rounded-md w-3/4"></div>
                                            <div className="h-3 bg-surface-light/50 animate-pulse rounded-md w-1/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-foreground pb-8 w-full">
                        <div className="w-full h-62.5 md:h-100 shrink-0 bg-surface-light relative">
                            {movieData?.images?.webp?.large_image_url && (
                                <Image
                                    src={movieData.images.webp.large_image_url}
                                    alt={movieData?.title || "baner"}
                                    fill
                                    className='object-cover'
                                    sizes="(max-width: 768px) 100vw, 896px"
                                    priority
                                />
                            )}
                            <div className="absolute inset-0 bg-linear-to-t from-surface via-surface/40 to-transparent" />
                        </div>

                        <div className="px-4 md:px-8 mt-4 relative z-10">
                            <h1 className="text-2xl md:text-4xl font-bold mb-2 drop-shadow-lg text-foreground">
                                {movieData?.title || "Brak tytułu"}
                            </h1>
                            <p className='text-sm md:text-base text-muted mb-8 line-clamp-4 md:line-clamp-none'>
                                {movieData?.synopsis || "Brak opisu."}
                            </p>

                            <h2 className="text-lg md:text-xl font-semibold mb-4 text-foreground" >
                                Odcinki ({episodes.length})
                            </h2>

                            <div className="flex flex-col gap-3">
                                {episodes.map((ep) => (
                                    <div
                                        key={ep.mal_id}
                                        className='flex items-center gap-4 p-3 md:p-4 bg-surface-light/50 rounded-lg border border-border hover:border-border-hover hover:bg-surface-light transition-all cursor-pointer group'
                                    >
                                        <div className="relative w-32 h-20 md:w-40 md:h-24 shrink-0 rounded-md overflow-hidden bg-background">
                                            {ep.images?.jpg?.image_url ? (
                                                <Image
                                                    src={ep.images.jpg.image_url}
                                                    alt={`Odcinek ${ep.episode}`}
                                                    fill
                                                    className='object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer'
                                                    sizes="(max-width: 768px) 128px, 160px"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full text-muted text-xs">
                                                    Brak miniaturki
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                                                <Play size={24} className='fill-foreground text-foreground'/>
                                            </div>
                                        </div>

                                        <div className="flex flex-col flex-1">
                                            <span className="text-foreground font-semibold text-sm md:text-base line-clamp-2">
                                                {ep.episode}. {ep.title_english ? ep.title_english : ep.title}
                                            </span>
                                            <span className='text-xs text-muted mt-1'>
                                                Odcinek
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {episodes.length === 0 && (
                                    <div className="text-muted text-sm py-4">
                                        Brak dostępnych odcinków w bazie.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SeriesModal;