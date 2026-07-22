import HeroBanerSection from "@/components/HeroBanerSection";
import ContentRow from "@/components/ContentRow";
import {getTopMovie} from "@/lib/fetchMoviePopular";
import {getMovieNewest} from "@/lib/fetchMovieNewest";
import SeriesModal from "@/components/SeriesModal";
import {Suspense} from "react";
import {getLocalUploads} from "@/lib/fetchLocalUploads";


export default async function Home() {
    const [topMovie, newestMovie, localSeries] = await Promise.all([
        getTopMovie(),
        getMovieNewest(),
        getLocalUploads()
    ]);

    return (
        <>
            <main className='w-full min-w-0 max-w-full min-h-screen bg-background pb-20 overflow-x-hidden'>
                <HeroBanerSection/>

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