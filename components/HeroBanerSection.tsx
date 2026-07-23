"use client";
import { Play, Download, MoreHorizontal, Clock, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useState, useRef, useEffect, MouseEvent } from "react";
import { useRouter } from "next/navigation";

export interface LastWatchedData {
    seriesId: string;
    episodeFile: string;
    progressPercent: number;
    lastWatchedTime: number;
    image: string;
    video: string;
    description: string;
    tags: string[];
}

interface HeroBanerProps {
    lastWatchedData: LastWatchedData | null;
}

const HeroBanerSection = ({ lastWatchedData }: HeroBanerProps) => {

    const router = useRouter();

    const randomShowcaseData = {
        seriesId: "Neon Genesis: Cyber City",
        episodeFile: "S1:E1",
        progressPercent: 0,
        lastWatchedTime: 0,
        image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1974&auto=format&fit=crop",
        video: 'https://www.w3schools.com/html/mov_bbb.mp4',
        description: "Kiedy dwa zwaśnione klony odkrywają tajny portal, podróżują przez magiczne wymiary, próbując odnaleźć drogę powrotną do domu, zanim system ulegnie całkowitemu resetowi.",
        tags: ["Cyberpunk", "Action"]
    };

    const activeContent = lastWatchedData || randomShowcaseData;

    const [isVideoActive, setIsVideoActive] = useState<boolean>(false);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isMuted, setIsMuted] = useState<boolean>(true); // Zmienione domyślnie na true, przeglądarki blokują autoplay z dźwiękiem

    const handleHover = () => {
        if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
            return;
        }
        hoverTimeout.current = setTimeout(() => {
            setIsVideoActive(true);
        }, 250);
    }

    const handleHoverEnd = () => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setIsVideoActive(false);
        setIsMuted(true);
    }

    const handleLoadedMetadata = () => {
        if (videoRef.current && activeContent.lastWatchedTime > 0) {
            videoRef.current.currentTime = Math.max(0, activeContent.lastWatchedTime - 10);
        }
    };

    useEffect(() => {
        if(isVideoActive && videoRef.current){
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined){
                playPromise.catch((err) => {
                    console.warn("Autoplay has been blocked, muted the video", err);
                    setIsMuted(true);
                    if(videoRef.current){
                        videoRef.current.muted = true;
                        videoRef.current.play().catch(() => {});
                    }
                });
            }
        }
    }, [isVideoActive]);

    const toggleMute = (e: MouseEvent) => {
        e.preventDefault();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handlePlayClick = () => {
        router.push(`/watch?id=${encodeURIComponent(activeContent.seriesId)}&ep=${encodeURIComponent(activeContent.episodeFile)}`);
    };

    return (
        <div
            onMouseEnter={handleHover}
            onMouseLeave={handleHoverEnd}
            className={`rounded-3xl shadow-2xl m-auto mt-15 relative bg-surface w-[85%] border border-white/5 h-[50vh] md:h-[60vh] overflow-hidden group  
            duration-700 cursor-pointer hover:scale-105 hover:shadow-[0_0_50px_var(--primary)]`}
        >
            <Image
                src={activeContent.image}
                alt={activeContent.seriesId}
                fill
                priority
                className={`object-cover transition-all duration-700 ${isVideoActive ? 'scale-105 opacity-0' : 'scale-100 opacity-100'}`}
            />

            {isVideoActive && (
                <div className='absolute inset-0 w-full h-full scale-105 animate-[fade-in_500ms_ease-in-out]'>
                    <video
                        ref={videoRef}
                        src={activeContent.video}
                        onLoadedMetadata={handleLoadedMetadata}
                        muted={isMuted}
                        loop
                        playsInline
                        className='w-full h-full object-cover'
                    />
                </div>
            )}

            <div className="absolute inset-x-0 bg-linear-to-t from-background/95 via-background/40 to-transparent md:bg-linear-to-r md:from-background md:via-background/80 md:to-transparent z-10 pointer-events-none"/>
            <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent opacity-100 md:opacity-80 z-10 pointer-events-none"/>

            {isVideoActive && (
                <button
                    onClick={toggleMute}
                    className="absolute cursor-pointer bottom-6 right-6 z-40 hidden md:flex items-center justify-center w-10 h-10 bg-surface/50 hover:bg-surface/80 backdrop-blur-md border border-white/10 rounded-full text-foreground transition-all duration-300 active:scale-95"
                >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
            )}

            <div className="absolute inset-0 p-5 md:p-10 flex flex-col justify-end w-full md:max-w-3xl z-20 pointer-events-none">
                {lastWatchedData && (
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur border border-white/5 rounded-full px-3 py-1.5 w-fit mb-3 md:mb-4">
                        <Clock size={14} className='text-primary' />
                        <span className="text-xs font-medium text-foreground">Kontynuuj Oglądanie</span>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-2 md:mb-3">
                    {activeContent.tags.map((tag, idx) => (
                        <span key={idx} className="text-[0.625rem] md:text-xs font-medium px-2.5 py-1 bg-surface/50 backdrop-blur-md border border-white/5 rounded-full text-foreground/80">
                            {tag}
                        </span>
                    ))}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-2 md:mb-3 leading-tight text-balance">
                    {activeContent.seriesId}
                </h1>

                <p className="text-xs md:text-base text-muted line-clamp-2 md:line-clamp-3 mb-6 md:mb-8 max-w-xl">
                    {activeContent.description}
                </p>

                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto z-30 pointer-events-auto">
                    <button
                        onClick={handlePlayClick}
                        className='flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-foreground font-semibold cursor-pointer py-2.5 md:py-3 px-6 rounded-3xl transition-all duration-300 active:scale-95'
                    >
                        <Play size={18} fill='currentColor' className='md:w-5 md:h-5'/>
                        <span className="text-sm md:text-base whitespace-nowrap">
                            Wznów {activeContent.episodeFile.replace('.mp4', '')}
                        </span>
                    </button>

                    <button className='flex items-center cursor-pointer justify-center bg-surface/50 hover:bg-white/10 border border-white/10 text-foreground w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all duration-300 backdrop-blur-md shrink-0 active:scale-95'>
                        <Download size={18} className="md:w-5 md:h-5" />
                    </button>

                    <button className='flex items-center justify-center cursor-pointer bg-surface/50 hover:bg-white/10 border border-white/10 text-foreground w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all backdrop-blur-md shrink-0 active:scale-95'>
                        <MoreHorizontal size={18} className="md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            {lastWatchedData && (
                <div className="absolute bottom-0 left-0 w-full h-1 md:h-1.5 bg-surface/50 z-30 pointer-events-none">
                    <div
                        className="h-full bg-primary glow-primary rounded-r-full transition-all duration-1000"
                        style={{ width: `${activeContent.progressPercent}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default HeroBanerSection;