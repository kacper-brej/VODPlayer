import HeroBanerSection from "@/components/HeroBanerSection";
import ContentRow from "@/components/ContentRow";
import {getTopMovie} from "@/lib/fetchMoviePopular";
import {getMovieNewest} from "@/lib/fetchMovieNewest";
import SeriesModal from "@/components/SeriesModal";
import {Suspense} from "react";
import {getLocalUploads} from "@/lib/fetchLocalUploads";


const getLastWatched = async () => {
    try {
        const key = process.env.UPLOAD_SECRET;
        const res = await fetch(`https://vids.kacper-brej.pl/sync_progress.php?key=${key}&action=get_latest&profile=Kacper`, {
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();

            if (data && data.seriesId) {
                return {
                    seriesId: data.seriesId,
                    episodeFile: data.fileID,
                    lastWatchedTime: data.time || 0,
                    progressPercent: 0,
                    image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1974&auto=format&fit=crop",
                    video: `https://vids.kacper-brej.pl/uploads/${encodeURIComponent(data.seriesId)}/${encodeURIComponent(data.fileID)}`,
                    description: "Kontynuuj oglądanie",
                    tags: ["Wznowione"]
                };
            }
        }
    } catch (e) {
        console.error("Failed to download history:", e);
    }

    return null;
}


export default async function Home() {
    const [topMovie, newestMovie, localSeries, lastWatched] = await Promise.all([
        getTopMovie(),
        getMovieNewest(),
        getLocalUploads(),
        getLastWatched()
    ]);

    return (
        <>
            <main className='w-full min-w-0 max-w-full min-h-screen bg-background pb-20 overflow-x-hidden'>
                <HeroBanerSection lastWatchedData={lastWatched}/>

                <div className="mt-8 md:mt-12 flex flex-col gap-6 px-8">
                    {localSeries && localSeries.length > 0 && (
                        <ContentRow title='Biblioteka' series={localSeries} />
                    )}
                    <ContentRow title='Hot takes' series={topMovie}/>
                    <ContentRow title='Nowości' series={newestMovie}/>
                    <ContentRow title='Obejrzyj ponownie' series={topMovie}/>
                </div>
                <Suspense fallback={null}>
                    <SeriesModal />
                </Suspense>
            </main>
        </>
    );
}