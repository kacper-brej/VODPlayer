import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ContentRow, { type ContentRowVariant } from "@/components/series/ContentRow";

const renderRow = (count: number, variant: ContentRowVariant) => {
    const mounted: number[] = [];
    const Card = ({ index }: { index: number }) => {
        mounted.push(index);
        return jsx("article", { "data-content-card": true, children: `Title ${index}` });
    };
    const html = renderToStaticMarkup(jsx(ContentRow, {
        title: "Library",
        variant,
        itemCount: count,
        children: Array.from({ length: count }, (_, index) => jsx(Card, { index }, index)),
        renderPlaceholder: (index: number) => jsx("a", {
            href: `/series/${index}`,
            "data-content-card": true,
            "data-row-placeholder": true,
            children: `Title ${index}`,
        }),
    }));

    return { html, mounted };
};

describe("content row rendering", () => {
    it("renders twelve full cards while keeping every title and offscreen destination in a long row", () => {
        const { html, mounted } = renderRow(200, "classic");

        expect(mounted).toEqual(Array.from({ length: 12 }, (_, index) => index));
        expect(html.match(/data-row-item="\d+"/gu)).toHaveLength(200);
        expect(html.match(/Title \d+</gu)).toHaveLength(200);
        expect(html).toContain('href="/series/199"');
    });

    it("preserves all cards in short rows and in the mosaic", () => {
        expect(renderRow(24, "ranking").mounted).toHaveLength(24);
        expect(renderRow(30, "mosaic").mounted).toHaveLength(30);
    });
});
