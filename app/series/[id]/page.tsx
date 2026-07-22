"use client"

import db from '@/db.json'
import { useState } from "react";
import Image from "next/image"
import { Play } from "lucide-react";
import SeasonSelector from "@/components/SeasonsSelector";
import EpisodeList from "@/components/EpisodeList";

const SeriesPage = ({params}: {params:{id:string}}) => {
    const seriesID = Number(params.id);
    const seriesInfo = db.series.find((s) => s.id === seriesID);
    const seriesEpisodes = (db.episodes as any)[seriesID] || [];

    const [activeSeason, setActiveSeason] = useState(1);
    const availableSeasons = [1];

    if(!seriesInfo){
        return (
            <div className='w-full min-h-screen bg-background flex items-center justify-center text-white'>
                <h1 className="text-2xl font-bold">Nie znaleziono serialu</h1>
            </div>
        )
    }

    return (
        <main className='w-full min-h-screen bg-background pb-20'>

            {/* maly hero baner */}
            <div className="relative w-full h-[40vh] md:h-[50vh]">
                <Image
                    src={seriesInfo.coverImage}
                    alt={String(seriesInfo.title)}
                    fill
                    className='object-cover opacity-40'
                    priority
                />

                <div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 w-full px-4 md:px-8 max-w-5xl mx-auto pb-8 flex flex-col md:flex-row gap-6 items-end">
                    <div className="hidden md:block relative w-40 aspect-2/3 rounded-xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
                        <Image
                            src={seriesInfo.coverImage}
                            alt={String(seriesInfo.title)}
                            fill
                            className='object-cover'
                        />
                    </div>
                    <div className="flex flex-col gap-3 w-full relative z-10">
                        <h1 className="text-3xl md:text-5xl font-bold text-foreground drop-shadow-lg">
                            {seriesInfo.title}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-white/80">
                            {seriesInfo.year && <span>{seriesInfo.year}</span>}
                            {seriesInfo.rating && (
                                <span className='px-1.5 py-0.5 border border-white/30 rounded bg-black/40 backdrop-blur-sm'>
                                    {seriesInfo.rating}
                                </span>
                            )}
                        </div>
                        <button className="mt-2 w-fit flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5
                        rounded-lg font-semibold transition-colors shadow-lg shadow-primary/30">
                            <Play size={20} className='fill-white'/>
                            Oglądaj od początku
                        </button>
                    </div>
                </div>
            </div>

            <section className='mt-8 px-4 md:px-8 w-full max-w-5xl mx-auto'>
                {seriesEpisodes.length > 0 ? (
                    <>
                        <SeasonSelector
                            seasons={availableSeasons}
                            activeSeason={activeSeason}
                            onSeasonChange={setActiveSeason}
                        />
                        <EpisodeList episodes={seriesEpisodes} />
                    </>
                ) : (
                    <p className="text-white/50 text-center py-10">Brak odcinków do wyświetlenia.</p>
                )}
            </section>
        </main>
    )
}
export default SeriesPage;