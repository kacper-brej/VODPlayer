import ContentRow, { type ContentRowVariant } from "@/components/series/ContentRow";
import SeriesCard, { type CardInput, type ContentCardVariant } from "@/components/series/SeriesCard";

interface ContentRowSectionProps {
    title: string;
    kicker: string;
    variant: ContentRowVariant;
    items: CardInput[];
}

const cardVariant = (
    variant: ContentRowVariant,
    index: number,
): ContentCardVariant => {
    if (variant === "ranking") return "poster";
    if (variant === "mosaic") return index === 0 ? "mosaic" : "row";
    return "landscape";
};

const cardSizes = (variant: ContentRowVariant, index: number) => {
    if (variant === "ranking") {
        return "(max-width: 639px) 34vw, (max-width: 1023px) 23vw, (max-width: 1279px) 19vw, (max-width: 1439px) 16vw, 14vw";
    }

    if (variant === "mosaic") {
        return index === 0
            ? "(max-width: 1023px) 100vw, (max-width: 1439px) 56vw, 58vw"
            : "(max-width: 1023px) 116px, 132px";
    }

    if (variant === "progress") {
        return "(max-width: 639px) 82vw, (max-width: 1023px) 48vw, (max-width: 1439px) 31vw, 24vw";
    }

    return "(max-width: 639px) 70vw, (max-width: 1023px) 44vw, (max-width: 1279px) 31vw, (max-width: 1439px) 24vw, 19vw";
};

const ContentRowSection = ({
    title,
    kicker,
    variant,
    items,
}: ContentRowSectionProps) => {
    if (items.length === 0) return null;

    const firstNewIndex = items.findIndex((item) => item.isNew);

    return (
        <ContentRow
            title={title}
            kicker={kicker}
            variant={variant}
            itemCount={items.length}
        >
            {items.map((item, index) => {
                const showNew = index === firstNewIndex;

                return (
                    <SeriesCard
                        key={`${item.seriesKey}:${item.episodeKey ?? "series"}`}
                        item={{
                            ...item,
                            isNew: showNew,
                        }}
                        variant={cardVariant(variant, index)}
                        featured={variant === "mosaic" && index === 0}
                        sizes={cardSizes(variant, index)}
                    />
                );
            })}
        </ContentRow>
    );
};

export default ContentRowSection;
