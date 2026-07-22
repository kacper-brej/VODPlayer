"use client"
import { useState, FormEvent, useRef } from "react";
import { UploadCloud, CheckCircle, Film, FileVideo, X } from 'lucide-react'

const CHUNK_SIZE = 5 * 1024 * 1024;

const UploadPage = () => {
    const [title, setTitle] = useState<string>("");
    const [episodes, setEpisodes] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [statusText, setStatusText] = useState<string>("");
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isSuccess, setIsSuccess] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.includes('video'));
            setEpisodes(prev => [...prev, ...droppedFiles]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            setEpisodes(prev => [...prev, ...selectedFiles]);
        }
    };

    const removeFile = (indexToRemove: number) => {
        setEpisodes(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const uploadFileChunks = async (file: File, folder: string) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append("key", process.env.NEXT_PUBLIC_UPLOAD_SECRET || "");
            formData.append("folder", folder);
            formData.append("filename", file.name);
            formData.append("chunkIndex", chunkIndex.toString());
            formData.append("totalChunks", totalChunks.toString());
            formData.append("file", chunk);

            const response = await fetch("https://vids.kacper-brej.pl/upload.php", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Błąd serwera przy wysyłaniu części ${chunkIndex + 1}`);
            }

            const percentComplete = Math.round(((chunkIndex + 1) / totalChunks) * 100);
            setProgress(percentComplete);
        }
    };

    const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (episodes.length === 0 || !title) return;

        setIsUploading(true);
        setProgress(0);
        setIsSuccess(false);

        try {
            for (let i = 0; i < episodes.length; i++) {
                setStatusText(`Przesyłanie: ${episodes[i].name} (${i + 1}/${episodes.length})`);
                await uploadFileChunks(episodes[i], title);
            }

            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                setTitle("");
                setEpisodes([]);
                setProgress(0);
                setStatusText("");
            }, 3000);

        } catch (error: any) {
            console.error("Błąd podczas wysyłania:", error);
            alert(`Wystąpił błąd: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col p-4 md:p-8">
            <div className="w-full max-w-2xl mx-auto bg-surface rounded-2xl shadow-2xl border border-border p-6 md:p-10 mt-8 md:mt-16 relative overflow-hidden">

                {isSuccess && (
                    <div className="absolute inset-0 bg-surface/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
                        <CheckCircle className="text-green-500 w-24 h-24 mb-4 animate-in zoom-in duration-500" />
                        <h2 className="text-3xl font-bold text-foreground">Wgrano pomyślnie!</h2>
                        <p className="text-muted mt-2">Pliki są już gotowe na serwerze.</p>
                    </div>
                )}

                <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 flex items-center gap-3 text-foreground">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <UploadCloud className="text-primary w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    Upload
                </h1>

                <form onSubmit={handleUpload} className="space-y-6 md:space-y-8">
                    <div>
                        <label className="block text-sm font-medium text-muted mb-2">
                            Tytuł Serii (Nazwa folderu)
                        </label>
                        <input
                            type="text"
                            required
                            disabled={isUploading}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-surface-light border border-border rounded-xl p-4 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all text-base md:text-lg disabled:opacity-50"
                            placeholder="np. Steins Gate"
                        />
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-base md:text-lg font-semibold flex items-center gap-2 text-foreground">
                            <Film size={20} className="text-primary" />
                            Pliki Wideo (.mp4)
                        </h2>

                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center transition-all duration-300 ease-in-out
                                ${isUploading ? 'opacity-50 cursor-not-allowed border-border bg-surface' : 'cursor-pointer'}
                                ${isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border bg-surface-light/30 hover:border-primary/50 hover:bg-surface-light'}
                            `}
                        >
                            <input
                                type="file"
                                accept="video/mp4,video/x-m4v,video/*"
                                multiple
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                disabled={isUploading}
                            />

                            <UploadCloud
                                size={48}
                                className={`mb-4 transition-colors duration-300 ${isDragging ? 'text-primary animate-bounce' : 'text-muted'}`}
                            />
                            <p className="text-lg font-medium text-foreground mb-1">
                                Przeciągnij i upuść pliki wideo tutaj
                            </p>
                            <p className="text-sm text-muted">
                                lub kliknij, aby przeglądać pliki na dysku
                            </p>
                        </div>

                        {episodes.length > 0 && !isUploading && (
                            <div className="bg-surface-light border border-border rounded-xl p-4 max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                                {episodes.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-surface p-3 rounded-lg border border-border/50">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FileVideo className="text-primary shrink-0" size={20} />
                                            <span className="text-sm truncate text-foreground">{file.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(idx)}
                                            className="text-muted hover:text-red-500 transition-colors p-1"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {isUploading && (
                            <div className="mt-6 w-full bg-surface-light border border-border rounded-xl p-5 shadow-inner">
                                <div className="flex justify-between mb-3 text-sm font-medium text-foreground">
                                    <span className="truncate pr-4 text-primary">{statusText}</span>
                                    <span className="font-bold">{progress}%</span>
                                </div>
                                <div className="w-full bg-background border border-border rounded-full h-4 overflow-hidden relative">
                                    <div
                                        className="h-full rounded-full transition-all duration-300 ease-out relative bg-linear-to-t from-indigo-500 via-primary to-purple-500"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isUploading || episodes.length === 0 || !title}
                        className="w-full bg-primary hover:bg-primary/90 text-background font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98]"
                    >
                        {isUploading ? (
                            "Trwa Przesyłanie..."
                        ) : (
                            <>
                                <UploadCloud size={24} />
                                Rozpocznij Wgrywanie
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default UploadPage;