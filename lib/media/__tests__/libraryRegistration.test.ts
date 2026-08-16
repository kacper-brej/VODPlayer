import { describe, expect, it } from "vitest";
import {
    compareLibrary,
    libraryStoragePrefix,
    registrableEntries,
    type RegisteredAssetKey,
} from "../libraryRegistration";
import type { ScannedSeries } from "../libraryScanClient";

const onDisk: ScannedSeries[] = [
    {
        seriesKey: "Tokyo Ghoul √A",
        episodes: [
            { episodeKey: "01.mp4", sizeBytes: 700_000_000, previewClipKey: "01.preview.mp4" },
            { episodeKey: "02.mp4", sizeBytes: 690_000_000, previewClipKey: null },
        ],
    },
];

describe("porownanie dysku ze stanem bazy", () => {
    it("odcinek bez assetu jest nowy i mozna go zarejestrowac", () => {
        const entries = compareLibrary(onDisk, []);
        expect(entries.map((entry) => entry.state)).toEqual(["new", "new"]);
        expect(registrableEntries(entries)).toHaveLength(2);
    });

    it("odcinek z assetem pliku jest juz zarejestrowany", () => {
        const registered: RegisteredAssetKey[] = [
            { seriesKey: "Tokyo Ghoul √A", episodeKey: "01.mp4", delivery: "file" },
        ];
        const entries = compareLibrary(onDisk, registered);
        expect(entries[0]).toMatchObject({ episodeKey: "01.mp4", state: "registered" });
        expect(registrableEntries(entries).map((entry) => entry.episodeKey)).toEqual(["02.mp4"]);
    });

    it("odcinek z gotowym HLS nie jest proponowany do rejestracji", () => {
        const registered: RegisteredAssetKey[] = [
            { seriesKey: "Tokyo Ghoul √A", episodeKey: "01.mp4", delivery: "hls" },
        ];
        const entries = compareLibrary(onDisk, registered);
        expect(entries[0]).toMatchObject({ state: "hls" });
        expect(registrableEntries(entries).map((entry) => entry.episodeKey)).toEqual(["02.mp4"]);
    });

    it("asset pliku bez pliku na dysku jest pokazany, ale nie do rejestracji", () => {
        const registered: RegisteredAssetKey[] = [
            { seriesKey: "Frieren", episodeKey: "07.mp4", delivery: "file" },
        ];
        const entries = compareLibrary(onDisk, registered);
        const orphan = entries.find((entry) => entry.episodeKey === "07.mp4");
        expect(orphan).toMatchObject({ state: "orphaned", sizeBytes: null });
        expect(registrableEntries(entries).every((entry) => entry.seriesKey === "Tokyo Ghoul √A")).toBe(true);
    });

    it("brakujacy asset HLS nie jest zglaszany jako sierota", () => {
        const registered: RegisteredAssetKey[] = [
            { seriesKey: "Frieren", episodeKey: "07.mp4", delivery: "hls" },
        ];
        expect(compareLibrary(onDisk, registered).some((entry) => entry.state === "orphaned")).toBe(false);
    });

    it("sortuje naturalnie, wiec 10 nie laduje przed 2", () => {
        const entries = compareLibrary([{
            seriesKey: "Frieren",
            episodes: [
                { episodeKey: "10.mp4", sizeBytes: 1, previewClipKey: null },
                { episodeKey: "2.mp4", sizeBytes: 1, previewClipKey: null },
            ],
        }], []);
        expect(entries.map((entry) => entry.episodeKey)).toEqual(["2.mp4", "10.mp4"]);
    });

    it("prefiks magazynu wskazuje katalog serii", () => {
        expect(libraryStoragePrefix("Tokyo Ghoul √A")).toBe("uploads/Tokyo Ghoul √A");
    });
});

describe("klip podgladowy obok odcinka", () => {
    it("jedzie razem z pozycja, zeby rejestracja mogla go zapisac", () => {
        const entries = compareLibrary(onDisk, []);
        expect(entries.find((entry) => entry.episodeKey === "01.mp4")?.previewClipKey)
            .toBe("01.preview.mp4");
        expect(entries.find((entry) => entry.episodeKey === "02.mp4")?.previewClipKey).toBeNull();
    });

    it("pozycja bez pliku na dysku nie udaje, ze ma podglad", () => {
        const entries = compareLibrary(onDisk, [
            { seriesKey: "Frieren", episodeKey: "07.mp4", delivery: "file" },
        ]);
        expect(entries.find((entry) => entry.state === "orphaned")?.previewClipKey).toBeNull();
    });
});
