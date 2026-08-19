const CatalogSkeleton = () => (
    <div className="min-h-dvh bg-nx-bg px-5 pb-[calc(80px+env(safe-area-inset-bottom))] pt-12 sm:px-8 lg:pb-20 lg:pt-16 xl:px-10 min-[1440px]:px-12">
        <div className="h-3 w-40 rounded-full bg-nx-panel skeleton-pulse" />
        <div className="mt-5 h-12 w-full max-w-xl rounded-2xl bg-nx-panel skeleton-pulse" />
        <div className="mt-8 flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-11 w-28 shrink-0 rounded-full bg-nx-panel skeleton-pulse" />
            ))}
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="aspect-video rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-12 xl:col-span-8" />
            <div className="aspect-video rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-6 xl:col-span-4" />
            <div className="aspect-video rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-6 xl:col-span-4" />
            <div className="aspect-video rounded-2xl bg-nx-panel skeleton-pulse lg:col-span-6 xl:col-span-4" />
        </div>
    </div>
);

export default CatalogSkeleton;
