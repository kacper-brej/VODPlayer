import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/catalog/catalog", () => ({ loadCatalogPayload: mocks.load }));
import { getCatalogEpisodeKeys } from "../catalogEpisodeKeys";

describe("catalog episode keys", () => {
    it("only reads episode keys of the selected published series", async () => {
        const unrelated = { key: "other", get episodes() { throw new Error("Unrelated episodes"); } };
        const episode = { key: "01.mp4", get media() { throw new Error("Playback data"); } };
        mocks.load.mockResolvedValue({ series: [unrelated, { key: "selected", episodes: [episode] }] });
        expect(await getCatalogEpisodeKeys("selected")).toEqual(["01.mp4"]);
        expect(await getCatalogEpisodeKeys("missing")).toEqual([]);
    });
    it("preserves the empty fallback on catalog failure", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.load.mockRejectedValue(new Error("Unavailable"));
        try { expect(await getCatalogEpisodeKeys("selected")).toEqual([]); }
        finally { log.mockRestore(); }
    });
});
