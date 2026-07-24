import Image from "next/image"
import { Play } from "lucide-react";
import EpisodeList from "@/components/EpisodeList";
import { getLocalUploads } from "@/lib/fetchLocalUploads";
import { getEpisodeWatchedSeconds, secondsToProgressPercent } from "@/lib/watchProgress";

const SeriesPage = async ({params}: {params: Promise<{id:string}>}) => {
    const resolvedParams = await params;
    const seriesID = Number(resolvedParams.id);
    const localUploads = await getLocalUploads();
    const seriesInfo = localUploads.find(s => s.id === seriesID);

    if(!seriesInfo){
        return (
            <div className='w-full min-h-screen bg-background flex items-center justify-center text-foreground'>
                <h1 className="text-2xl font-bold">Nie znaleziono serialu</h1>
            </div>
        )
    }

    const seriesEpisodes = await Promise.all(seriesInfo.localEpisodes.map(async (epName, index) => {
        const watchedSeconds = await getEpisodeWatchedSeconds(String(seriesInfo.title), epName);

        return {
            id: `${seriesInfo.id}-${index + 1}`,
            seriesId: seriesInfo.id,
            episodeNumber: index + 1,
            title: `Odcinek ${index + 1}`,
            duration: "24 min",
            description: epName,
            thumbnail: seriesInfo.coverImage,
            progress: watchedSeconds > 0 ? secondsToProgressPercent(watchedSeconds) : undefined,
        };
    }));

    return (
        <main className='w-full min-h-screen bg-background pb-20'>
            {/* Mały hero baner */}
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
                        <div className="flex items-center gap-3 text-sm text-foreground/80">
                            {seriesInfo.year && <span>{seriesInfo.year}</span>}
                            {seriesInfo.rating && (
                                <span className='px-1.5 py-0.5 border border-white/30 rounded bg-black/40 backdrop-blur-sm'>
                                    {seriesInfo.rating}
                                </span>
                            )}
                        </div>
                        <button className="mt-2 w-fit flex items-center gap-2 bg-primary hover:bg-primary-hover text-foreground px-6 py-2.5
                        rounded-lg font-semibold transition-colors shadow-lg shadow-primary/30">
                            <Play size={20} className='fill-foreground'/>
                            Oglądaj od początku
                        </button>
                    </div>
                </div>
            </div>

            <section className='mt-8 px-4 md:px-8 w-full max-w-5xl mx-auto'>
                {seriesEpisodes.length > 0 ? (
                    <EpisodeList
                        episodes={seriesEpisodes}
                        seriesId={seriesInfo.id}
                    />
                ) : (
                    <p className="text-muted text-center py-10">Brak odcinków do wyświetlenia.</p>
                )}
            </section>
        </main>
    )
}

export default SeriesPage;