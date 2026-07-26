import HeroBanerSection from "@/components/series/HeroBanerSection";
import ContentRow from "@/components/series/ContentRow";
import {getTopMovie} from "@/lib/fetchMoviePopular";
import {getMovieNewest} from "@/lib/fetchMovieNewest";
import SeriesModal from "@/components/series/SeriesModal";
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
                    image: "/fallback-cover.jpg",
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


const Hero = async () => {
    const lastWatched = await getLastWatched();
    return <HeroBanerSection lastWatchedData={lastWatched}/>;
}

const LibraryRow = async () => {
    const [localSeries, lastWatched] = await Promise.all([getLocalUploads(), getLastWatched()]);

    const localSeriesWithProgress = lastWatched
        ? localSeries.map((item) =>
            String(item.title) === lastWatched.seriesId
                ? { ...item, watchedSeconds: lastWatched.lastWatchedTime }
                : item
          )
        : localSeries;

    if (!localSeriesWithProgress || localSeriesWithProgress.length === 0) return null;

    return <ContentRow title='Biblioteka' series={localSeriesWithProgress} />;
}

const TopMovieRows = async () => {
    const topMovie = await getTopMovie();
    return (
        <>
            <ContentRow title='Hot takes' series={topMovie}/>
            <ContentRow title='Obejrzyj ponownie' series={topMovie}/>
        </>
    );
}

const NewestRow = async () => {
    const newestMovie = await getMovieNewest();
    return <ContentRow title='Nowości' series={newestMovie}/>;
}

export default function Home() {
    return (
        <main className='w-full min-w-0 max-w-full min-h-screen bg-background pb-20 overflow-x-hidden'>
            <Suspense fallback={null}>
                <Hero/>
            </Suspense>

            <div className="mt-8 md:mt-12 flex flex-col gap-6 px-8">
                <Suspense fallback={null}>
                    <LibraryRow/>
                </Suspense>
                <Suspense fallback={null}>
                    <TopMovieRows/>
                </Suspense>
                <Suspense fallback={null}>
                    <NewestRow/>
                </Suspense>
            </div>
            <Suspense fallback={null}>
                <SeriesModal/>
            </Suspense>
        </main>
    );
}