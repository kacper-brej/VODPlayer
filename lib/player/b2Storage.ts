import "server-only";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { EnvironmentConfigError, requireEnvValue, type EnvSource } from "@/lib/config/env";

export class B2ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "B2ConfigError";
    }
}

export interface B2Config {
    endpoint: string;
    region: string;
    bucket: string;
    readKeyId: string;
    readAppKey: string;
}

declare global {
    var __nocturnaB2Client: S3Client | undefined;
}

export const readB2Config = (env: EnvSource = process.env): B2Config => {
    try {
        return {
            endpoint: requireEnvValue(env, "B2_ENDPOINT"),
            region: requireEnvValue(env, "B2_REGION"),
            bucket: requireEnvValue(env, "B2_BUCKET"),
            readKeyId: requireEnvValue(env, "B2_READ_KEY_ID"),
            readAppKey: requireEnvValue(env, "B2_READ_APP_KEY"),
        };
    } catch (error) {
        if (error instanceof EnvironmentConfigError) throw new B2ConfigError(error.message);
        throw error;
    }
};

const getB2Client = (config: B2Config): S3Client => {
    if (globalThis.__nocturnaB2Client) return globalThis.__nocturnaB2Client;

    const client = new S3Client({
        endpoint: `https://${config.endpoint}`,
        region: config.region,
        forcePathStyle: true,
        credentials: { accessKeyId: config.readKeyId, secretAccessKey: config.readAppKey },
    });

    globalThis.__nocturnaB2Client = client;
    return client;
};

export const B2_BUCKET = () => readB2Config().bucket;

export const presignedObjectUrl = async (objectKey: string, expiresInSeconds: number): Promise<string> => {
    const config = readB2Config();
    const client = getB2Client(config);

    return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
        { expiresIn: expiresInSeconds },
    );
};

export const fetchObjectText = async (objectKey: string): Promise<string | null> => {
    const config = readB2Config();
    const client = getB2Client(config);

    try {
        const response = await client.send(
            new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
        );
        return (await response.Body?.transformToString()) ?? null;
    } catch {
        console.error("b2Storage: nie udalo sie pobrac playlisty");
        return null;
    }
};
