
export const ASSUMED_EPISODE_DURATION_SECONDS = 24 * 60;
export const WATCHED_THRESHOLD_PERCENT = 90;

export const getEpisodeWatchedSeconds = async (folderTitle: string, fileName: string): Promise<number> => {
    const key = process.env.NEXT_PUBLIC_UPLOAD_SECRET;

    try {
        const res = await fetch(
            `https://vids.kacper-brej.pl/sync_progress.php?key=${key}&action=get_time&profile=Kacper&path=${encodeURIComponent(folderTitle)}&fileID=${encodeURIComponent(fileName)}`,
            { cache: 'no-store' }
        );

        if (!res.ok) return 0;
        const data = await res.json();
        return data.time || 0;
    } catch (error) {
        console.error("Błąd pobierania postępu odcinka:", error);
        return 0;
    }
};

export const secondsToProgressPercent = (seconds: number) =>
    Math.min(100, Math.round((seconds / ASSUMED_EPISODE_DURATION_SECONDS) * 100));
