import "server-only";
import { requireHttpsUrl, type EnvSource } from "@/lib/config/env";

const DEFAULT_REST_ORIGIN = "https://rest.ably.io";
const DEFAULT_STREAM_ORIGIN = "https://realtime.ably.io";
const TOKEN_TTL_SECONDS = 900;
const REQUEST_TIMEOUT_MS = 5_000;

export type PartyChannelErrorCode = "disabled" | "misconfigured" | "upstream";

export class PartyChannelError extends Error {
    readonly code: PartyChannelErrorCode;
    readonly httpStatus: number;

    constructor(code: PartyChannelErrorCode, message: string) {
        super(message);
        this.name = "PartyChannelError";
        this.code = code;
        this.httpStatus = code === "disabled" ? 503 : code === "misconfigured" ? 500 : 502;
    }
}

export interface PartyChannelGrant {
    channelName: string;
    streamUrl: string;
    expiresAtMs: number;
}

export interface RealtimeMessage {
    name: string;
    data: unknown;
}

interface ChannelConfig {
    keyName: string;
    authorization: string;
    restOrigin: string;
    streamOrigin: string;
}

interface TokenResponse {
    token?: unknown;
    expires?: unknown;
}

export const partyChannelName = (roomCode: string): string => `party:${roomCode}`;

export const arePartiesEnabled = (env: EnvSource = process.env): boolean =>
    Boolean(env.PARTY_REALTIME_KEY?.trim());

const readOrigin = (env: EnvSource, name: string, fallback: string): string =>
    env[name]?.trim()
        ? requireHttpsUrl(env, name)
        : fallback;

const readConfig = (env: EnvSource): ChannelConfig => {
    const key = env.PARTY_REALTIME_KEY?.trim();
    if (!key) {
        throw new PartyChannelError("disabled", "Watch Party jest wyłączone.");
    }

    const separator = key.indexOf(":");
    if (separator <= 0 || separator === key.length - 1) {
        throw new PartyChannelError(
            "misconfigured",
            "PARTY_REALTIME_KEY musi mieć postać <nazwa klucza>:<sekret>.",
        );
    }

    return {
        keyName: key.slice(0, separator),
        authorization: `Basic ${Buffer.from(key, "utf8").toString("base64")}`,
        restOrigin: readOrigin(env, "PARTY_REALTIME_REST_ORIGIN", DEFAULT_REST_ORIGIN),
        streamOrigin: readOrigin(env, "PARTY_REALTIME_STREAM_ORIGIN", DEFAULT_STREAM_ORIGIN),
    };
};

const postJson = async (url: string, authorization: string, body: unknown): Promise<Response> => {
    try {
        return await fetch(url, {
            method: "POST",
            headers: { Authorization: authorization, "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
    } catch {
        throw new PartyChannelError("upstream", "Usługa kanału nie odpowiada.");
    }
};

export const issueChannelToken = async (
    roomCode: string,
    env: EnvSource = process.env,
): Promise<PartyChannelGrant> => {
    const config = readConfig(env);
    const channelName = partyChannelName(roomCode);

    const response = await postJson(
        `${config.restOrigin}/keys/${encodeURIComponent(config.keyName)}/requestToken`,
        config.authorization,
        {
            keyName: config.keyName,
            capability: JSON.stringify({ [channelName]: ["subscribe"] }),
            ttl: TOKEN_TTL_SECONDS * 1000,
            timestamp: Date.now(),
        },
    );

    if (!response.ok) {
        throw new PartyChannelError("upstream", "Nie udało się uzyskać dostępu do kanału.");
    }

    const payload = await response.json().catch(() => null) as TokenResponse | null;
    const token = typeof payload?.token === "string" ? payload.token : "";
    if (!token) {
        throw new PartyChannelError("upstream", "Usługa kanału zwróciła nieprawidłową odpowiedź.");
    }

    const expiresAtMs = typeof payload?.expires === "number" && Number.isFinite(payload.expires)
        ? payload.expires
        : Date.now() + TOKEN_TTL_SECONDS * 1000;

    const streamUrl = new URL(`${config.streamOrigin}/sse`);
    streamUrl.searchParams.set("v", "1.2");
    streamUrl.searchParams.set("channels", channelName);
    streamUrl.searchParams.set("accessToken", token);

    return { channelName, streamUrl: streamUrl.toString(), expiresAtMs };
};

export const publishPartyEvent = async (
    roomCode: string,
    message: RealtimeMessage,
    env: EnvSource = process.env,
): Promise<void> => {
    const config = readConfig(env);
    const channelName = partyChannelName(roomCode);

    const response = await postJson(
        `${config.restOrigin}/channels/${encodeURIComponent(channelName)}/messages`,
        config.authorization,
        { name: message.name, data: message.data },
    );

    if (!response.ok) {
        throw new PartyChannelError("upstream", "Nie udało się rozesłać zdarzenia pokoju.");
    }
};
