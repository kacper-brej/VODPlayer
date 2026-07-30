import CatalogScreen, { type CatalogSearchParams } from "@/components/series/CatalogScreen";

const ExplorePage = ({ searchParams }: { searchParams: CatalogSearchParams }) => (
    <CatalogScreen
        mode="all"
        basePath="/explore"
        searchParams={searchParams}
    />
);

export default ExplorePage;
