import {Play, Download, MoreHorizontal, Clock} from "lucide-react";
import Image from "next/image";
import {useState, useRef, useEffect} from "react";

const HeroBanerSection = () => {

    const lastWatchedData = null;
    const randomShowcaseData = {
        image: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1974&auto=format&fit=crop"
        , video: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
    }
    const activeContent = lastWatchedData || randomShowcaseData;
    const [isVideoActive, setIsVideoActive] = useState<boolean>(false);
    const hoverTimeout = useRef<NodeJS.Timeout | null>(null)
    const handleHover = () => {
        if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
            return;
        }
        hoverTimeout.current = setTimeout(() => {
            setIsVideoActive(true);
        }, 250)
    }
    const handleHoverEnd = () => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setIsVideoActive(false);
    }

    useEffect(() => {
        if(isVideoActive && videoRef.cu)
    },[isVideoActive]);
    return (
        <>
            <div
                onMouseEnter={handleHover}
                onMouseLeave={handleHoverEnd}
                className={`rounded-3xl shadow-2xl relative bg-surface w-full border border-white/5
                         h-[50vh] md:h-[60vh] overflow-hidden group ${isVideoActive ? "scale-105 opacity-0 transition-all duration-500" : "opacity-100"}`}
            >
                <Image
                    src={`https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1974&auto=format&fit=crop"`}
                    alt={`current anime`}
                    fill
                    priority
                    className={`object-cover`}/>
                {isVideoActive && (
                    <div className='absolute inset-y-0 w-full h-full scale-105 animate-animate-[fade-in_500ms_ease-in-out]'>
                        <video
                            src={activeContent.video}
                            autoPlay
                            playsInline
                            className='w-full h-full object-cover'
                        />
                    </div>
                )}
                <div className="absolute inset-x-0 bg-linear-to-t from-background/95 via-background/40 to-transparent
                    md:bg-linear-to-r md:from-background md:via-background/80 md:to-transparent"/>
                <div className="absolute inset-0 bg-linear-to-t from-background via-transparent
                    to-transparent opacity-100 md:opacity-80"/>
                <div className="absolute inset-0 p-5 md:p-10 flex flex-col justify-end w-full md:max-w-3xl">
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur border border-white/5 rounded-full
                     px-3 py-1.5 w-fit mb-3 md:mb-4"
                    >
                    <span className="text-xs font-medium text-foreground">Continue Watching</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 md:mb-3">
                        <span className="text-[0.625rem] md:text-xs font-medium px-2.5 py-1 bg-surface/50 backdrop-blur-md border border-white/5 rounded-full text-foreground/80">Cyberpunk</span>
                        <span className="text-[0.625rem] md:text-xs font-medium px-2.5 py-1 bg-surface/50 backdrop-blur-md border border-white/5 rounded-full text-foreground/80">Action</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-2 md:mb-3 leading-tight text-balance">
                        Neon Genesis: <br className="hidden md:block" />
                        Cyber City
                    </h1>
                    <p className="text-xs md:text-base text-muted line-clamp-2 md:line-clamp-3 mb-6 md:mb-8 max-w-xl">
                        Kiedy dwa zwaśnione klony odkrywają tajny portal, podróżują przez magiczne wymiary, próbując odnaleźć drogę powrotną do domu, zanim system ulegnie całkowitemu resetowi.
                    </p>
                    <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto z-30">
                        <button className='flex-1 md:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover
                        text-foreground font-semibold py-2.5 md:py-3 px-6 rounded-xl transition-all duration-300 active:scale-95'>
                            <Play size={18} fill='currentColor' className='md:w-5 md:h-5'/>
                            <span className="text-sm md:text-base whitespace-nowrap">Resume S1:E4</span>
                        </button>

                        <button className='flex items-center justify-center bg-surface/50 hover:bg-white/10 border border-white/10
                        text-foreground w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all duration-300 backdrop:blur-md shrink-0 active:scale-95'>
                            <Download size={18} className="md:w-5 md:h-5" />
                        </button>

                        <button className='flex items-center justify-center bg-surface/50 hover:bg-white/10 border border-white/10 text-foreground
                         w-11 h-11 md:w-12 md:h-12 rounded-xl transition-all backdrop-blur-md shrink-0 active:scale-95'>
                            <MoreHorizontal size={18} className="md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-1 md:h-1.5 bg-surface/50 z-30">
                    <div className="h-full bg-primary glow-primary w-[45%] rounded-r-full" />
                </div>
            </div>
        </>
    );
};
export default HeroBanerSection;