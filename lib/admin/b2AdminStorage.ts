import "server-only";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { EnvironmentConfigError, requireEnvValue, type EnvSource } from "@/lib/config/env";
import { isSafeMediaIdentitySegment } from "@/lib/media/mediaLifecycle";

export interface DeleteB2Config {
    endpoint: string;
    region: string;
    bucket: string;
    keyId: string;
    appKey: string;
}

export class DeleteB2ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DeleteB2ConfigError";
    }
}

export const readDeleteB2Config = (env: EnvSource = process.env): DeleteB2Config => {
    try {
        return {
            endpoint: requireEnvValue(env, "B2_ENDPOINT"),
            region: requireEnvValue(env, "B2_REGION"),
            bucket: requireEnvValue(env, "B2_BUCKET"),
            keyId: requireEnvValue(env, "B2_DELETE_KEY_ID"),
            appKey: requireEnvValue(env, "B2_DELETE_APP_KEY"),
        };
    } catch (error) {
        if (error instanceof EnvironmentConfigError) throw new DeleteB2ConfigError(error.message);
        throw error;
    }
};

export const deleteB2Prefix = async (prefix: string): Promise<number> => {
    const parts = prefix.split("/");
    if (
        parts.length !== 4
        || parts[0] !== "media"
        || !isSafeMediaIdentitySegment(parts[1] ?? "")
        || !isSafeMediaIdentitySegment(parts[2] ?? "")
        || parts[3] !== ""
    ) {
        throw new Error("Nieprawidłowy canonical prefix do usunięcia z B2.");
    }
    const config = readDeleteB2Config();
    const client = new S3Client({
        endpoint: `https://${config.endpoint}`,
        region: config.region,
        forcePathStyle: true,
        credentials: { accessKeyId: config.keyId, secretAccessKey: config.appKey },
    });
    let continuationToken: string | undefined;
    let deleted = 0;

    try {
        do {
            const listed = await client.send(new ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));
            const objects = (listed.Contents ?? [])
                .map(({ Key }) => Key ? { Key } : null)
                .filter((entry): entry is { Key: string } => entry !== null);
            if (objects.length > 0) {
                const result = await client.send(new DeleteObjectsCommand({
                    Bucket: config.bucket,
                    Delete: { Objects: objects, Quiet: true },
                }));
                if (result.Errors?.length) {
                    throw new Error(`B2 nie usunęło ${result.Errors.length} obiektów.`);
                }
                deleted += objects.length;
            }
            continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (continuationToken);
        return deleted;
    } finally {
        client.destroy();
    }
};

export interface ListedMediaObjects {
    keys: string[];
    truncated: boolean;
}

export const listB2MediaObjectKeys = async (maximumKeys = 100_000): Promise<ListedMediaObjects> => {
    const config = readDeleteB2Config();
    const client = new S3Client({
        endpoint: `https://${config.endpoint}`,
        region: config.region,
        forcePathStyle: true,
        credentials: { accessKeyId: config.keyId, secretAccessKey: config.appKey },
    });
    const keys: string[] = [];
    let continuationToken: string | undefined;
    let truncated = false;

    try {
        do {
            const listed = await client.send(new ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: "media/",
                ContinuationToken: continuationToken,
            }));
            for (const object of listed.Contents ?? []) {
                if (object.Key) keys.push(object.Key);
                if (keys.length >= maximumKeys) {
                    truncated = Boolean(listed.IsTruncated) || keys.length >= maximumKeys;
                    return { keys: keys.slice(0, maximumKeys), truncated };
                }
            }
            continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (continuationToken);
        return { keys, truncated };
    } finally {
        client.destroy();
    }
};
