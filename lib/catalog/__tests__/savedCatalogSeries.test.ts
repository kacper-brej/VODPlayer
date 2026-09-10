import { describe, expect, it, vi } from "vitest";
import type { getVirtualTmdbTitle } from "@/lib/catalog/tmdbVirtualSeries";
import { dataEmpty, dataFailure, dataSuccess } from "@/lib/core/dataResult";
import { resolveSavedCatalogSeries } from "../savedCatalogSeries";
import { catalogSeriesFixture } from "./catalogSeriesFixture";

const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
};

describe("resolveSavedCatalogSeries", () => {
    it("keeps saved local titles in saved order and prefers local data for virtual keys", async () => {
        const first = catalogSeriesFixture("first");
        const localVirtual = catalogSeriesFixture("tmdb:1399");
        const unsaved = catalogSeriesFixture("unsaved");
        const catalog = Object.freeze([first, localVirtual, unsaved]);
        const keys = Object.freeze(["tmdb:1399", "first", "tmdb:1399"]);
        const resolveVirtual = vi.fn<typeof getVirtualTmdbTitle>();

        const result = await resolveSavedCatalogSeries(catalog, keys, resolveVirtual);

        expect(result).toEqual({ series: [localVirtual, first], unavailableKeys: [] });
        expect(result.series[0]).toBe(localVirtual);
        expect(resolveVirtual).not.toHaveBeenCalled();
        expect(catalog).toEqual([first, localVirtual, unsaved]);
        expect(keys).toEqual(["tmdb:1399", "first", "tmdb:1399"]);
    });

    it("restores saved television and movie titles that are absent from the local catalog", async () => {
        const television = catalogSeriesFixture("tmdb:1399");
        const movie = catalogSeriesFixture("tmdb:movie:603");
        const resolveVirtual = vi.fn<typeof getVirtualTmdbTitle>()
            .mockResolvedValueOnce(dataSuccess(television))
            .mockResolvedValueOnce(dataSuccess(movie));

        const result = await resolveSavedCatalogSeries([], [television.key, movie.key, television.key], resolveVirtual);

        expect(result).toEqual({ series: [television, movie], unavailableKeys: [] });
        expect(resolveVirtual).toHaveBeenCalledTimes(2);
        expect(resolveVirtual).toHaveBeenNthCalledWith(1, { kind: "tv", id: 1399 });
        expect(resolveVirtual).toHaveBeenNthCalledWith(2, { kind: "movie", id: 603 });
    });

    it("reports missing, failed and rejected titles once while preserving available titles", async () => {
        const local = catalogSeriesFixture("local");
        const virtual = catalogSeriesFixture("tmdb:4");
        const resolveVirtual = vi.fn<typeof getVirtualTmdbTitle>()
            .mockResolvedValueOnce(dataEmpty(null))
            .mockResolvedValueOnce(dataFailure("network"))
            .mockRejectedValueOnce(new Error("unavailable"))
            .mockResolvedValueOnce(dataSuccess(virtual));

        const result = await resolveSavedCatalogSeries(
            [local],
            ["missing-local", "tmdb:1", "local", "tmdb:2", "tmdb:3", "tmdb:4", "tmdb:1", "missing-local", "tmdb:invalid"],
            resolveVirtual,
        );

        expect(result).toEqual({
            series: [local, virtual],
            unavailableKeys: ["missing-local", "tmdb:1", "tmdb:2", "tmdb:3", "tmdb:invalid"],
        });
        expect(resolveVirtual).toHaveBeenCalledTimes(4);
    });

    it("does not resolve any titles for an empty saved list", async () => {
        const resolveVirtual = vi.fn<typeof getVirtualTmdbTitle>();

        await expect(resolveSavedCatalogSeries([catalogSeriesFixture("local")], [], resolveVirtual))
            .resolves.toEqual({ series: [], unavailableKeys: [] });
        expect(resolveVirtual).not.toHaveBeenCalled();
    });

    it("limits virtual requests to three while retaining saved order when requests finish out of order", async () => {
        const titles = [1, 2, 3, 4, 5].map((id) => catalogSeriesFixture(`tmdb:${id}`));
        const gates = titles.map(() => deferred());
        const fourthStarted = deferred();
        let active = 0;
        let maximum = 0;
        const resolveVirtual = vi.fn<typeof getVirtualTmdbTitle>(async ({ id }) => {
            active += 1;
            maximum = Math.max(maximum, active);
            if (id === 4) fourthStarted.resolve();
            await gates[id - 1].promise;
            active -= 1;
            return dataSuccess(titles[id - 1]);
        });

        const pending = resolveSavedCatalogSeries([], titles.map((title) => title.key), resolveVirtual);
        expect(resolveVirtual).toHaveBeenCalledTimes(3);
        expect(active).toBe(3);

        gates[1].resolve();
        await fourthStarted.promise;
        expect(resolveVirtual).toHaveBeenCalledTimes(4);
        expect(active).toBe(3);
        gates.forEach((gate) => gate.resolve());

        await expect(pending).resolves.toEqual({ series: titles, unavailableKeys: [] });
        expect(resolveVirtual).toHaveBeenCalledTimes(5);
        expect(maximum).toBe(3);
        expect(active).toBe(0);
    });
});
