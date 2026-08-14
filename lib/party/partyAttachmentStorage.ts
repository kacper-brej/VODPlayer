import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EnvironmentConfigError, requireEnvValue, type EnvSource } from "@/lib/config/env";
import { isPartyStorageKey, partyAttachmentContentType } from "@/lib/party/partyAttachment";

export class PartyAttachmentStorageConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PartyAttachmentStorageConfigError";
    }
}

interface PartyAttachmentStorageConfig {
    endpoint: string;
    region: string;
    bucket: string;
    keyId: string;
    appKey: string;
}

declare global {
    var __nocturnaPartyAttachmentClient: S3Client | undefined;
}

export const readPartyAttachmentStorageConfig = (
    env: EnvSource = process.env,
): PartyAttachmentStorageConfig => {
    try {
        return {
            endpoint: requireEnvValue(env, "B2_ENDPOINT"),
            region: requireEnvValue(env, "B2_REGION"),
            bucket: requireEnvValue(env, "B2_BUCKET"),
            keyId: requireEnvValue(env, "B2_PARTY_WRITE_KEY_ID"),
            appKey: requireEnvValue(env, "B2_PARTY_WRITE_APP_KEY"),
        };
    } catch (error) {
        if (error instanceof EnvironmentConfigError) {
            throw new PartyAttachmentStorageConfigError(error.message);
        }
        throw error;
    }
};

const getClient = (config: PartyAttachmentStorageConfig): S3Client => {
    globalThis.__nocturnaPartyAttachmentClient ??= new S3Client({
        endpoint: `https://${config.endpoint}`,
        region: config.region,
        forcePathStyle: true,
        credentials: { accessKeyId: config.keyId, secretAccessKey: config.appKey },
    });
    return globalThis.__nocturnaPartyAttachmentClient;
};

const assertStorageKey = (objectKey: string): void => {
    if (!isPartyStorageKey(objectKey)) throw new Error("Nieprawidłowy klucz załącznika pokoju.");
};

export const putPartyAttachmentObject = async (objectKey: string, data: Buffer): Promise<void> => {
    assertStorageKey(objectKey);
    const config = readPartyAttachmentStorageConfig();
    await getClient(config).send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: data,
        ContentLength: data.byteLength,
        ContentType: partyAttachmentContentType(objectKey),
        CacheControl: "private, max-age=21600",
    }));
};

export const presignPartyAttachmentObject = async (
    objectKey: string,
    expiresInSeconds: number,
): Promise<string> => {
    assertStorageKey(objectKey);
    const config = readPartyAttachmentStorageConfig();
    return getSignedUrl(
        getClient(config),
        new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
        { expiresIn: expiresInSeconds },
    );
};
