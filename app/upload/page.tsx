"use client"
import { useEffect, useRef, useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, CheckCircle, Film, FileVideo, X, Type, TriangleAlert } from 'lucide-react'
import getUploadKeyAction from "@/lib/getUploadKeyAction";
import { cn } from "@/lib/utils";

const CHUNK_SIZE = 5 * 1024 * 1024;
const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|webm|m4v|flv|wmv)$/i;

type QueuedFile = {
    id: string;
    file: File;
};

const isVideoFile = (file: File) => file.type.startsWith("video/") || VIDEO_EXTENSIONS.test(file.name);

const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
};

function Input({ className, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            data-slot="input"
            className={cn(
                "flex h-14 w-full min-w-0 rounded-xl border border-transparent bg-surface-light/50 px-4 text-base md:text-lg text-foreground placeholder:text-muted shadow-xs outline-none transition-all duration-300 focus:border-primary/40 focus:bg-surface-light focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        />
    );
}

const UploadPage = () => {
    const [title, setTitle] = useState<string>("");
    const [titleFocused, setTitleFocused] = useState<boolean>(false);
    const [episodes, setEpisodes] = useState<QueuedFile[]>([]);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [statusText, setStatusText] = useState<string>("");
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);
    const rejectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const preventDefault = (e: DragEvent) => e.preventDefault();
        window.addEventListener("dragover", preventDefault);
        window.addEventListener("drop", preventDefault);
        return () => {
            window.removeEventListener("dragover", preventDefault);
            window.removeEventListener("drop", preventDefault);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (rejectedTimeoutRef.current) clearTimeout(rejectedTimeoutRef.current);
        };
    }, []);

    const flashRejectedMessage = (message: string) => {
        if (rejectedTimeoutRef.current) clearTimeout(rejectedTimeoutRef.current);
        setRejectedMessage(message);
        rejectedTimeoutRef.current = setTimeout(() => setRejectedMessage(null), 3200);
    };

    const addFiles = (fileList: FileList | File[]) => {
        const incoming = Array.from(fileList);
        const valid = incoming.filter(isVideoFile);
        const rejected = incoming.length - valid.length;

        if (valid.length > 0) {
            setEpisodes(prev => [...prev, ...valid.map(file => ({ id: crypto.randomUUID(), file }))]);
        }

        if (rejected > 0) {
            flashRejectedMessage(`Pominięto pliki w nieobsługiwanym formacie (${rejected})`);
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (isUploading) return;
        dragCounter.current += 1;
        setIsDragging(true);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (isUploading) return;
        dragCounter.current = Math.max(0, dragCounter.current - 1);
        if (dragCounter.current === 0) setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);
        if (isUploading) return;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
        }
        e.target.value = "";
    };

    const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isUploading) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
        }
    };

    const removeFile = (id: string) => {
        setEpisodes(prev => prev.filter(item => item.id !== id));
    };

    const uploadFileChunks = async (file: File, folder: string, key: string) => {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append("key", key);
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
        setUploadError(null);

        try {
            const key = await getUploadKeyAction();
            if (!key) {
                throw new Error("Brak autoryzacji - zaloguj się ponownie");
            }

            for (let i = 0; i < episodes.length; i++) {
                setStatusText(`Przesyłanie: ${episodes[i].file.name} (${i + 1}/${episodes.length})`);
                await uploadFileChunks(episodes[i].file, title, key);
            }

            setIsSuccess(true);
            setTimeout(() => {
                setIsSuccess(false);
                setTitle("");
                setEpisodes([]);
                setProgress(0);
                setStatusText("");
            }, 3000);

        } catch (error: unknown) {
            console.error("Błąd podczas wysyłania:", error);
            setUploadError(error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd podczas wysyłania.");
        } finally {
            setIsUploading(false);
        }
    };

    const canSubmit = !isUploading && episodes.length > 0 && !!title;

    return (
        <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col items-center px-4 py-10 md:py-16">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-surface/30 to-background" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[110vh] h-[50vh] rounded-b-full bg-primary/20 blur-[90px] opacity-60" />
            <div className="absolute bottom-0 right-1/4 translate-x-1/3 w-96 h-96 bg-accent/10 rounded-full blur-[100px] opacity-40" />

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-2xl relative z-10"
            >
                <div className="relative group">
                    <div
                        className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none"
                        style={{ boxShadow: "0 0 24px 2px var(--glow-primary)" }}
                    />

                    <div className="relative bg-surface/60 backdrop-blur-xl rounded-2xl border border-white/[0.05] shadow-2xl p-6 md:p-10 overflow-hidden">
                        <div
                            className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{
                                backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
                                backgroundSize: '30px 30px'
                            }}
                        />

                        <AnimatePresence>
                            {isSuccess && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeOut" }}
                                    className="absolute inset-0 bg-surface/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center px-6"
                                >
                                    <motion.div
                                        initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                                        className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-4"
                                        style={{ boxShadow: "0 0 40px 4px var(--glow-primary)" }}
                                    >
                                        <CheckCircle className="text-success w-12 h-12" />
                                    </motion.div>
                                    <motion.h2
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15, duration: 0.3 }}
                                        className="text-2xl md:text-3xl font-bold text-foreground"
                                    >
                                        Wgrano pomyślnie!
                                    </motion.h2>
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.25, duration: 0.3 }}
                                        className="text-muted mt-2"
                                    >
                                        Pliki są już gotowe na serwerze.
                                    </motion.p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
                            className="flex items-center gap-3 mb-6 md:mb-8"
                        >
                            <div className="p-3 bg-primary/10 rounded-xl shrink-0">
                                <UploadCloud className="text-primary w-6 h-6 md:w-8 md:h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80">
                                    Upload
                                </h1>
                                <p className="text-muted text-xs md:text-sm">
                                    Dodaj nowe odcinki do biblioteki Nocturna
                                </p>
                            </div>
                        </motion.div>

                        <form onSubmit={handleUpload} className="space-y-6 md:space-y-8 relative">
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
                            >
                                <label className="block text-sm font-medium text-muted mb-2">
                                    Tytuł serii (nazwa folderu)
                                </label>
                                <div className="relative flex items-center overflow-hidden rounded-xl">
                                    <Type
                                        className={cn(
                                            "absolute left-4 w-4 h-4 md:w-5 md:h-5 transition-colors duration-300",
                                            titleFocused ? "text-primary" : "text-muted"
                                        )}
                                    />
                                    <Input
                                        type="text"
                                        required
                                        disabled={isUploading}
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        onFocus={() => setTitleFocused(true)}
                                        onBlur={() => setTitleFocused(false)}
                                        className="pl-11 md:pl-12"
                                        placeholder="np. Steins Gate"
                                    />
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
                                className="space-y-4"
                            >
                                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2 text-foreground">
                                    <Film size={20} className="text-primary" />
                                    Pliki wideo
                                </h2>

                                <div
                                    onDragEnter={handleDragEnter}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => !isUploading && fileInputRef.current?.click()}
                                    onKeyDown={handleDropzoneKeyDown}
                                    role="button"
                                    tabIndex={isUploading ? -1 : 0}
                                    aria-disabled={isUploading}
                                    className={cn(
                                        "relative border-2 border-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center overflow-hidden transition-all duration-300 ease-out",
                                        isUploading
                                            ? "opacity-50 cursor-not-allowed border-border bg-surface"
                                            : "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                        !isUploading && isDragging && "border-primary bg-primary/10 scale-[1.02]",
                                        !isUploading && !isDragging && "border-border bg-surface-light/30 hover:border-border-hover hover:bg-surface-light"
                                    )}
                                >
                                    <motion.div
                                        aria-hidden
                                        className="pointer-events-none absolute inset-0 rounded-2xl"
                                        style={{ boxShadow: "inset 0 0 60px 0 var(--glow-primary)" }}
                                        initial={false}
                                        animate={{ opacity: isDragging ? 1 : 0 }}
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                    />

                                    <input
                                        type="file"
                                        accept="video/mp4,video/x-m4v,video/*"
                                        multiple
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        disabled={isUploading}
                                    />

                                    <motion.div
                                        animate={
                                            isDragging
                                                ? { y: [-2, -10, -2], scale: 1.08 }
                                                : { y: 0, scale: 1 }
                                        }
                                        transition={
                                            isDragging
                                                ? { y: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, scale: { duration: 0.3 } }
                                                : { duration: 0.3 }
                                        }
                                        className="mb-4 relative"
                                    >
                                        <UploadCloud
                                            size={48}
                                            className={cn("transition-colors duration-300", isDragging ? "text-primary" : "text-muted")}
                                        />
                                    </motion.div>

                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.p
                                            key={isDragging ? "drop" : "idle"}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            transition={{ duration: 0.2 }}
                                            className="text-lg font-medium text-foreground mb-1"
                                        >
                                            {isDragging ? "Upuść, aby dodać pliki" : "Przeciągnij i upuść pliki wideo tutaj"}
                                        </motion.p>
                                    </AnimatePresence>

                                    <p className="text-sm text-muted relative">
                                        lub kliknij, aby przeglądać pliki na dysku
                                    </p>
                                </div>

                                <AnimatePresence>
                                    {rejectedMessage && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6, height: 0 }}
                                            animate={{ opacity: 1, y: 0, height: "auto" }}
                                            exit={{ opacity: 0, y: -6, height: 0 }}
                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs md:text-sm text-warning">
                                                <TriangleAlert size={16} className="shrink-0" />
                                                {rejectedMessage}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {episodes.length > 0 && !isUploading && (
                                        <motion.div
                                            key="file-list"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-surface-light border border-border rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
                                                <AnimatePresence>
                                                    {episodes.map(({ id, file }) => (
                                                        <motion.div
                                                            key={id}
                                                            layout
                                                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.95 }}
                                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                                            className="flex items-center justify-between bg-surface p-3 rounded-lg border border-border/50"
                                                        >
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <FileVideo className="text-primary shrink-0" size={20} />
                                                                <div className="flex flex-col overflow-hidden">
                                                                    <span className="text-sm truncate text-foreground">{file.name}</span>
                                                                    <span className="text-xs text-muted">{formatFileSize(file.size)}</span>
                                                                </div>
                                                            </div>
                                                            <motion.button
                                                                type="button"
                                                                whileHover={{ scale: 1.1 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => removeFile(id)}
                                                                className="text-muted hover:text-danger transition-colors p-1.5 rounded-md hover:bg-danger/10 shrink-0"
                                                            >
                                                                <X size={18} />
                                                            </motion.button>
                                                        </motion.div>
                                                    ))}
                                                </AnimatePresence>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {isUploading && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3, ease: "easeOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="w-full bg-surface-light border border-border rounded-xl p-5 shadow-inner">
                                                <div className="flex justify-between mb-3 text-sm font-medium text-foreground">
                                                    <span className="truncate pr-4 text-primary">{statusText}</span>
                                                    <span className="font-bold">{progress}%</span>
                                                </div>
                                                <div className="w-full bg-background border border-border rounded-full h-4 overflow-hidden relative">
                                                    <motion.div
                                                        className="h-full rounded-full relative bg-linear-to-t from-accent via-primary to-primary-hover overflow-hidden"
                                                        initial={false}
                                                        animate={{ width: `${progress}%` }}
                                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                                    >
                                                        <motion.div
                                                            className="absolute inset-y-0 w-1/3 bg-white/25 blur-[2px]"
                                                            animate={{ x: ["-120%", "220%"] }}
                                                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                                                        />
                                                    </motion.div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>

                            <AnimatePresence>
                                {uploadError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: "auto" }}
                                        exit={{ opacity: 0, y: -6, height: 0 }}
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs md:text-sm text-danger">
                                            <TriangleAlert size={16} className="shrink-0" />
                                            {uploadError}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.button
                                whileHover={canSubmit ? { scale: 1.01 } : undefined}
                                whileTap={canSubmit ? { scale: 0.98 } : undefined}
                                type="submit"
                                disabled={!canSubmit}
                                className="w-full bg-primary hover:bg-primary/90 text-background font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg shadow-primary/25 hover:shadow-primary/40"
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    {isUploading ? (
                                        <motion.span
                                            key="uploading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex items-center gap-2"
                                        >
                                            <span className="w-5 h-5 border-2 border-background/70 border-t-transparent rounded-full animate-spin" />
                                            Trwa przesyłanie...
                                        </motion.span>
                                    ) : (
                                        <motion.span
                                            key="idle"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex items-center gap-2"
                                        >
                                            <UploadCloud size={24} />
                                            Rozpocznij wgrywanie
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </motion.button>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export default UploadPage;
