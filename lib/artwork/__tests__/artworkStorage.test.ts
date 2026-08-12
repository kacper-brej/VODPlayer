import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const getSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: class S3Client { send = send; },
    PutObjectCommand: class PutObjectCommand { constructor(public input: unknown) {} },
    DeleteObjectCommand: class DeleteObjectCommand { constructor(public input: unknown) {} },
    GetObjectCommand: class GetObjectCommand { constructor(public input: unknown) {} },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const {
    deleteArtworkObject,
    isArtworkStorageKey,
    presignArtworkObject,
    putArtworkObject,
} = await import("../artworkStorage");

const key = "artwork/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp";

beforeEach(() => {
    vi.clearAllMocks();
    process.env.B2_ENDPOINT = "s3.example.test";
    process.env.B2_REGION = "eu-test-1";
    process.env.B2_BUCKET = "bucket";
    process.env.B2_ARTWORK_WRITE_KEY_ID = "write-id";
    process.env.B2_ARTWORK_WRITE_APP_KEY = "write-secret";
    send.mockResolvedValue({});
    getSignedUrl.mockResolvedValue("https://b2.example/signed");
});

describe("isArtworkStorageKey", () => {
    it("akceptuje tylko scisly prefix, rodzaj i UUID WebP", () => {
        expect(isArtworkStorageKey(key)).toBe(true);
        expect(isArtworkStorageKey("media/Test/poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp")).toBe(false);
        expect(isArtworkStorageKey("artwork/../poster/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp")).toBe(false);
        expect(isArtworkStorageKey("artwork/Test/other/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp")).toBe(false);
    });
});

it("wysyla WebP z niezmiennym cache i usuwa dokladnie wskazany obiekt", async () => {
    await putArtworkObject(key, Buffer.from("webp"));
    await deleteArtworkObject(key);

    expect(send.mock.calls[0]?.[0].input).toMatchObject({
        Bucket: "bucket",
        Key: key,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
    });
    expect(send.mock.calls[1]?.[0].input).toEqual({ Bucket: "bucket", Key: key });
});

it("podpisuje GetObject tym samym kluczem Read and Write ograniczonym do artwork/", async () => {
    await expect(presignArtworkObject(key, 21_600)).resolves.toBe("https://b2.example/signed");
    expect(getSignedUrl.mock.calls[0]?.[1].constructor.name).toBe("GetObjectCommand");
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        input: { Bucket: "bucket", Key: key },
    }), { expiresIn: 21_600 });
});
