import CatalogScreen, { type CatalogSearchParams } from "@/components/series/CatalogScreen";

const RecentlyAddedPage = ({ searchParams }: { searchParams: CatalogSearchParams }) => (
    <CatalogScreen
        mode="recent"
        basePath="/recent"
        searchParams={searchParams}
    />
);

export default RecentlyAddedPage;
