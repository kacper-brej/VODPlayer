import type { ContentRowVariant } from "@/components/series/ContentRow";

interface ContentRowSkeletonProps {
    title: string;
    kicker: string;
    variant: ContentRowVariant;
}

const counts: Record<ContentRowVariant, number> = {
    progress: 4,
    ranking: 6,
    mosaic: 4,
    classic: 5,
};

const widthClass: Record<Exclude<ContentRowVariant, "mosaic">, string> = {
    progress: "basis-[82%] sm:basis-[48%] lg:basis-[calc((100%-40px)/3)] min-[1440px]:basis-[calc((100%-72px)/4)]",
    ranking: "basis-[40%] sm:basis-[28%] lg:basis-[calc((100%-60px)/4)] xl:basis-[calc((100%-96px)/5)] min-[1440px]:basis-[calc((100%-120px)/6)]",
    classic: "basis-[70%] sm:basis-[44%] lg:basis-[calc((100%-40px)/3)] xl:basis-[calc((100%-72px)/4)] min-[1440px]:basis-[calc((100%-96px)/5)]",
};

const ContentRowSkeleton = ({
    title,
    kicker,
    variant,
}: ContentRowSkeletonProps) => {
    const itemCount = counts[variant];

    return (
        <section aria-label={`Ładowanie sekcji ${title}`} className="w-full">
            <header className="mb-5 flex items-end gap-4 sm:mb-6">
                <div>
                    <span className="block font-mono text-[10px] tracking-[0.22em] text-nx-text-2 sm:text-[11px]">
                        {kicker}
                    </span>
            <h2 className="mt-1 text-xl font-semibold text-nx-text sm:font-display sm:text-[28px]">
                        {title}
                    </h2>
                </div>
                <span className="mb-2 h-px flex-1 bg-nx-border" />
            </header>

            {variant === "mosaic" ? (
                <div aria-hidden="true" className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-3 lg:gap-5 xl:gap-6">
                    <div className="aspect-video rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-7 lg:row-span-3" />
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className={`min-h-22 rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-5 ${index === 2 ? "lg:max-xl:hidden" : ""}`}
                        />
                    ))}
                </div>
            ) : (
                <div aria-hidden="true" className="scrollbar-hide flex gap-4 overflow-hidden py-3 lg:gap-5 xl:gap-6">
                    {Array.from({ length: itemCount }).map((_, index) => (
                        <div key={index} className={`shrink-0 ${widthClass[variant]}`}>
                            <div className={`${variant === "ranking" ? "aspect-2/3" : "aspect-video"} rounded-2xl bg-nx-panel skeleton-pulse`} />
                            <div className="mt-3 h-3 w-2/5 rounded-full bg-nx-panel skeleton-pulse" />
                            <div className="mt-2 h-5 w-4/5 rounded-full bg-nx-panel skeleton-pulse" />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default ContentRowSkeleton;
