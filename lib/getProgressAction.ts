"use server"
const getProgressAction = async (folderTitle: string, fileName: string): Promise<number> => {
    const key = process.env.UPLOAD_SECRET;

    if (!key) {
        console.error("key is required");
        return 0;
    }

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
}
export default getProgressAction;
