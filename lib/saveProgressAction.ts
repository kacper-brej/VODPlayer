"use server"
const saveProgressAction = async (currentTime: number, folderName: string, fileName:string, profile:string) => {
    const key = process.env.NEXT_PUBLIC_UPLOAD_SECRET;

    if(!key){
        console.error("key is required");
        return { success: false, error: "key is required" };
    }

    try{
        const response = await fetch(`https://vids.kacper-brej.pl/sync_progress.php`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                key: key,
                profile: profile,
                videoPath: folderName,
                fileID: fileName,
                time: currentTime,
            })
        });
        if(!response.ok){
            return { success: false, error: "PHP server error" };
        }
        return await response.json();
    }catch(err){
        console.error("API connection error", err);
        return { success: false, error: "error" };
    }
}
export default saveProgressAction;
