import CatalogScreen, { type CatalogSearchParams } from "@/components/series/CatalogScreen";

const FavouritesPage = ({ searchParams }: { searchParams: CatalogSearchParams }) => (
    <CatalogScreen
        mode="watchlist"
        basePath="/favourites"
        searchParams={searchParams}
    />
);

export default FavouritesPage;
