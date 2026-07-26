import { getLocalSeriesRaw } from "@/lib/fetchLocalUploads";
import WatchClient from "@/app/watch/WatchClient";

const WatchPage = async ({ searchParams }: { searchParams: Promise<{ id: string, ep: string }> }) => {
    const resolvedSearchParams = await searchParams;

    const seriesQueryId = resolvedSearchParams.id;
    const epQuery = resolvedSearchParams.ep;

    if (!seriesQueryId) {
        return <div className="fixed inset-0 z-[999] bg-black min-h-screen flex items-center justify-center text-foreground">Błędny link</div>;
    }

    const localUploads = await getLocalSeriesRaw();

    const seriesInfo = localUploads.find(s => String(s.title) === seriesQueryId || String(s.id) === seriesQueryId);

    if (!seriesInfo) {
        return <div className="fixed inset-0 z-[999] bg-black min-h-screen flex items-center justify-center text-foreground">Nie znaleziono serialu: {seriesQueryId}</div>;
    }

    let epFileName = "";
    let currentEpisode = 1;

    if (epQuery && epQuery.includes('.mp4')) {
        epFileName = epQuery;
        currentEpisode = seriesInfo.localEpisodes.indexOf(epFileName) + 1;
        if (currentEpisode === 0) currentEpisode = 1; // Zabezpieczenie
    } else {
        currentEpisode = Number(epQuery) || 1;
        epFileName = seriesInfo.localEpisodes[currentEpisode - 1];
    }

    if (!epFileName) {
        return <div className="fixed inset-0 z-[999] bg-black min-h-screen flex items-center justify-center text-foreground">Nie znaleziono pliku odcinka na serwerze</div>;
    }

    const baseUrl = "https://vids.kacper-brej.pl/uploads";
    const videoUrl = `${baseUrl}/${encodeURIComponent(seriesInfo.title)}/${encodeURIComponent(epFileName)}`;
    const title = `${seriesInfo.title} - Odcinek ${currentEpisode}`;
    const totalEpisodes = seriesInfo.localEpisodes.length;

    const key = process.env.UPLOAD_SECRET;
    let savedTime = 0;

    try {
        const timeRes = await fetch(
            `https://vids.kacper-brej.pl/sync_progress.php?key=${key}&action=get_time&profile=Kacper&path=${encodeURIComponent(seriesInfo.title)}&fileID=${encodeURIComponent(epFileName)}`,
            { cache: 'no-store' }
        );

        if (timeRes.ok) {
            const timeData = await timeRes.json();
            savedTime = timeData.time || 0;
        }
    } catch (e) {
        console.error("Błąd pobierania czasu:", e);
    }

    const startTime = Math.max(0, savedTime - 10);

    return (
        <WatchClient
            videoSrc={videoUrl}
            title={title}
            seriesId={seriesInfo.id}
            currentEpisode={currentEpisode}
            totalEpisodes={totalEpisodes}
            folderName={seriesInfo.title}
            fileName={epFileName}
            startTime={startTime}
        />
    );
};

export default WatchPage;