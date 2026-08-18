import { rowKickerClass, type ContentRowVariant } from "@/components/series/ContentRow";

interface ContentRowSkeletonProps {
    title: string;
    kicker?: string;
    numbered?: boolean;
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
    ranking: "basis-[40%] sm:basis-[30%] lg:basis-[calc((100%-168px)/4)] xl:basis-[calc((100%-256px)/5)] min-[1440px]:basis-[calc((100%-320px)/6)]",
    classic: "basis-[70%] sm:basis-[44%] lg:basis-[calc((100%-40px)/3)] xl:basis-[calc((100%-72px)/4)] min-[1440px]:basis-[calc((100%-96px)/5)]",
};

const ContentRowSkeleton = ({
    title,
    kicker,
    numbered = false,
    variant,
}: ContentRowSkeletonProps) => {
    const itemCount = counts[variant];

    return (
        <section aria-label={`Ładowanie sekcji ${title}`} aria-busy="true" className="w-full">
            <header className="mb-5 flex items-end gap-4 sm:mb-6">
                <div>
                    {numbered
                        ? <span aria-hidden="true" className={`nx-row-index ${rowKickerClass}`} />
                        : kicker && <span className={rowKickerClass}>{kicker}</span>}
                    <h2 className="mt-1 text-xl font-semibold text-nx-text sm:font-display sm:text-[28px]">
                        {title}
                    </h2>
                </div>
                <span className="mb-2 h-px flex-1 bg-nx-border" />
            </header>

            {variant === "mosaic" ? (
                <div aria-hidden="true" className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch lg:gap-5">
                    <div className="aspect-video rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-5 lg:aspect-auto lg:min-h-[610px] min-[1600px]:col-span-6" />
                    <div className="rounded-[22px] border border-nx-border bg-nx-panel p-3 sm:p-4 lg:col-span-7 lg:p-5 min-[1600px]:col-span-6">
                        <div className="flex items-center justify-between border-b border-nx-border pb-4">
                            <div className="h-7 w-40 rounded-full bg-nx-raised skeleton-pulse" />
                            <div className="h-11 w-64 rounded-xl bg-nx-raised skeleton-pulse" />
                        </div>
                        <div className="mt-4 grid gap-4">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="min-h-[164px] rounded-2xl bg-nx-raised skeleton-pulse"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    aria-hidden="true"
                    className={`scrollbar-hide flex overflow-hidden py-3 ${
                        variant === "ranking"
                            ? "gap-10 sm:gap-14 xl:gap-16"
                            : "gap-4 lg:gap-5 xl:gap-6"
                    }`}
                >
                    {Array.from({ length: itemCount }).map((_, index) => (
                        <div key={index} className={`shrink-0 ${widthClass[variant]}`}>
                            <div className={`${variant === "ranking" ? "aspect-2/3 rounded-md" : "aspect-video rounded-2xl"} bg-nx-panel skeleton-pulse`} />
                            {variant === "ranking" && (
                                <div className="mt-3 h-3 w-2/5 rounded-full bg-nx-panel skeleton-pulse" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default ContentRowSkeleton;
