import CatalogScreen, { type CatalogSearchParams } from "@/components/series/CatalogScreen";

const CollectionsPage = ({ searchParams }: { searchParams: CatalogSearchParams }) => (
    <CatalogScreen
        mode="collections"
        basePath="/collections"
        searchParams={searchParams}
    />
);

export default CollectionsPage;
