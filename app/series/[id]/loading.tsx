const SeriesLoading = () => (
    <div className="min-h-screen bg-nx-bg" aria-label="Ładowanie strony serialu" aria-busy="true">
        <div className="min-h-[58vh] skeleton-pulse" />
        <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-5 px-5 py-10 sm:px-8 lg:grid-cols-12 lg:px-10">
            <div className="col-span-4 h-40 rounded-2xl skeleton-pulse lg:col-span-4 lg:col-start-9" />
            <div className="col-span-4 h-8 w-44 rounded-lg skeleton-pulse lg:col-span-12" />
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="col-span-2 aspect-video rounded-2xl skeleton-pulse lg:col-span-3" />
            ))}
        </div>
    </div>
);

export default SeriesLoading;
