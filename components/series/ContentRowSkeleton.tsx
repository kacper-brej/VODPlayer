interface ContentRowSkeletonProps {
    title: string;
    count?: number;
}

const ContentRowSkeleton = ({ title, count = 6 }: ContentRowSkeletonProps) => {
    return (
        <div className='w-full my-4'>
            <h2 className='text-xl md:text-2xl font-bold text-foreground pt-4 px-4 md:px-8 mb-2'>
                {title}
            </h2>

            <div aria-hidden='true' className='flex flex-nowrap items-center gap-4 md:gap-6 overflow-hidden px-6 md:px-8 py-10'>
                {Array.from({ length: count }).map((_, index) => (
                    <div
                        key={index}
                        className='w-[70vw] sm:w-[45vw] md:w-[30vw] lg:w-[22vw] xl:w-[18vw] aspect-video flex-none shrink-0 rounded-lg overflow-hidden border border-white/5 shadow-lg skeleton-pulse'
                    />
                ))}
            </div>
        </div>
    );
};

export default ContentRowSkeleton;
