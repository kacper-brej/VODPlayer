import CatalogScreen, { type CatalogSearchParams } from "@/components/series/CatalogScreen";

const GenresPage = ({ searchParams }: { searchParams: CatalogSearchParams }) => (
    <CatalogScreen
        mode="genres"
        basePath="/genres"
        searchParams={searchParams}
    />
);

export default GenresPage;
