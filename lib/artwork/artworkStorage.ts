import "server-only";
import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EnvironmentConfigError, requireEnvValue, type EnvSource } from "@/lib/config/env";

export class ArtworkStorageConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ArtworkStorageConfigError";
    }
}

interface SharedConfig {
    endpoint: string;
    region: string;
    bucket: string;
}

export interface ArtworkStorageConfig extends SharedConfig {
    keyId: string;
    appKey: string;
}

declare global {
    var __nocturnaArtworkWriteClient: S3Client | undefined;
    var __nocturnaArtworkReadClient: S3Client | undefined;
}

export const readArtworkStorageConfig = (env: EnvSource = process.env): ArtworkStorageConfig => {
    try {
        return {
            endpoint: requireEnvValue(env, "B2_ENDPOINT"),
            region: requireEnvValue(env, "B2_REGION"),
            bucket: requireEnvValue(env, "B2_BUCKET"),
            keyId: requireEnvValue(env, "B2_ARTWORK_WRITE_KEY_ID"),
            appKey: requireEnvValue(env, "B2_ARTWORK_WRITE_APP_KEY"),
        };
    } catch (error) {
        if (error instanceof EnvironmentConfigError) throw new ArtworkStorageConfigError(error.message);
        throw error;
    }
};

const readWriteConfig = (): ArtworkStorageConfig => readArtworkStorageConfig();

const readReadConfig = (): ArtworkStorageConfig => {
    return readWriteConfig();
};

const createClient = (config: ArtworkStorageConfig): S3Client => new S3Client({
    endpoint: `https://${config.endpoint}`,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.keyId, secretAccessKey: config.appKey },
});

const getWriteClient = (config: ArtworkStorageConfig): S3Client => {
    globalThis.__nocturnaArtworkWriteClient ??= createClient(config);
    return globalThis.__nocturnaArtworkWriteClient;
};

const getReadClient = (config: ArtworkStorageConfig): S3Client => {
    globalThis.__nocturnaArtworkReadClient ??= createClient(config);
    return globalThis.__nocturnaArtworkReadClient;
};

export const isArtworkStorageKey = (value: string): boolean => {
    const parts = value.split("/");
    return parts.length === 4
        && parts[0] === "artwork"
        && parts[1].length > 0
        && parts[1].length <= 255
        && !parts[1].startsWith(".")
        && !/[\\\x00-\x1f\x7f]/u.test(parts[1])
        && (parts[2] === "poster" || parts[2] === "backdrop" || parts[2] === "logo")
        && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/iu.test(parts[3]);
};

const assertArtworkStorageKey = (objectKey: string): void => {
    if (!isArtworkStorageKey(objectKey)) throw new Error("Nieprawidłowy klucz obiektu grafiki.");
};

export const putArtworkObject = async (objectKey: string, data: Buffer): Promise<void> => {
    assertArtworkStorageKey(objectKey);
    const config = readWriteConfig();
    await getWriteClient(config).send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: data,
        ContentLength: data.byteLength,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
    }));
};

export const deleteArtworkObject = async (objectKey: string): Promise<void> => {
    assertArtworkStorageKey(objectKey);
    const config = readWriteConfig();
    await getWriteClient(config).send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
    }));
};

export const presignArtworkObject = async (
    objectKey: string,
    expiresInSeconds: number,
): Promise<string> => {
    assertArtworkStorageKey(objectKey);
    const config = readReadConfig();
    return getSignedUrl(
        getReadClient(config),
        new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
        { expiresIn: expiresInSeconds },
    );
};
