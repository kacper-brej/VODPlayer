"use client"
import SeriesCard, { SeriesCardProps } from "./SeriesCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

interface ContentRowProps {
    title: string;
    series: SeriesCardProps[];
}

const EAGER_PREVIEW_COUNT = 4;

const ContentRow = ({ title, series }: ContentRowProps) => {

    const rowRef = useRef<HTMLDivElement>(null);

    const uniqueSeries = series.filter(
        (item, index, self) => self.findIndex((s) => s.id === item.id) === index
    );

    const scroll = (direction: 'left' | 'right') => {
        const container = rowRef.current;
        const firstCard = container?.firstElementChild as HTMLElement | null;
        if(!container || !firstCard) return;

        const gap = parseFloat(getComputedStyle(container).columnGap || '0');
        const step = firstCard.offsetWidth + gap;
        const cardsPerView = Math.max(1, Math.floor(container.clientWidth / step));
        const scrollAmount = step * cardsPerView;

        const scrollTo = direction === 'left'
            ? container.scrollLeft - scrollAmount
            : container.scrollLeft + scrollAmount;
        container.scrollTo({left: scrollTo, behavior: 'smooth'});
    }

    return (
        <div className="w-full group/row my-4">
            <h2 className="text-xl md:text-2xl font-bold text-foreground pt-4 px-4 md:px-8 mb-2">
                {title}
            </h2>

            <div className="relative">
                <button
                    onClick={() => scroll('left')}
                    className='hidden md:flex absolute left-2 md:left-6 top-1/2 z-40 items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary
                    text-foreground shadow-[0_0_15px_var(--primary)] opacity-0 -translate-y-1/2 -translate-x-4 pointer-events-none
                    duration-300 group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:pointer-events-auto hover:scale-110 hover:brightness-110 cursor-pointer transition-all'
                >
                    <ChevronLeft size={40}/>
                </button>

                <div
                    ref={rowRef}
                    className='flex flex-nowrap items-center gap-4 md:gap-6 overflow-x-auto scroll-smooth scrollbar-hide px-6 md:px-8 scroll-pl-6 md:scroll-pl-8 scroll-pr-6 md:scroll-pr-8 py-10 snap-x snap-mandatory'
                >
                    {uniqueSeries.map((item, index) => (
                        <div
                            key={item.id}
                            className="group/card w-[70vw] sm:w-[45vw] md:w-[30vw] lg:w-[22vw] xl:w-[18vw] aspect-video flex-none shrink-0 snap-start hover:z-20 cursor-pointer"
                        >
                            <div
                                className={`w-full h-full relative rounded-lg overflow-hidden transition-all duration-300 group-hover/card:scale-110 group-hover/card:shadow-[0_0_20px_var(--primary)] border border-white/5 shadow-lg ${index === 0 ? 'origin-left' : index === uniqueSeries.length - 1 ? 'origin-right' : 'origin-center'}`}
                            >
                                <SeriesCard {...item} eagerPreview={index < EAGER_PREVIEW_COUNT} />
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => scroll("right")}
                    className="hidden md:flex absolute right-2 md:right-6 top-1/2 z-40 items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary
                    text-foreground shadow-[0_0_15px_var(--primary)] opacity-0 -translate-y-1/2 translate-x-4 pointer-events-none transition-all duration-300 group-hover/row:opacity-100
                     group-hover/row:translate-x-0 group-hover/row:pointer-events-auto hover:scale-110 hover:brightness-110 cursor-pointer"
                >
                    <ChevronRight size={40} />
                </button>
            </div>
        </div>
    );
};

export default ContentRow;