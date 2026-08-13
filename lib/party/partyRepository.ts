import "server-only";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import { parseNullableSafeDbInteger, parseSafeDbInteger, type DbInteger } from "@/lib/db/integer";
import type {
    WatchParty,
    WatchPartyAnchor,
    WatchPartyControlMode,
    WatchPartyMember,
    WatchPartyMessage,
    WatchPartyRole,
    WatchPartySnapshot,
    WatchPartyState,
} from "@/lib/core/contracts";
import { PARTY_TTL_SECONDS } from "./partyService";

type Executor = Pool | PoolConnection;

interface PartyRow extends RowDataPacket {
    id: DbInteger;
    room_code: string;
    host_profile_id: DbInteger;
    series_key: string;
    episode_key: string;
    state: WatchPartyState;
    position_seconds: string | number;
    anchor_version: DbInteger;
    control_mode: WatchPartyControlMode;
    position_updated_at_ms: DbInteger;
    created_at_ms: DbInteger;
    expires_at_ms: DbInteger;
    closed_at_ms: DbInteger | null;
    buffering_profile_id: DbInteger | null;
    buffering_started_at_ms: DbInteger | null;
    buffering_until_ms: DbInteger | null;
    buffering_cooldown_until_ms: DbInteger | null;
    server_now_ms: DbInteger;
}

interface MemberRow extends RowDataPacket {
    profile_id: DbInteger;
    name: string;
    avatar: string | null;
    role: WatchPartyRole;
    joined_at_ms: DbInteger;
    last_seen_at_ms: DbInteger;
    is_buffering: DbInteger;
}

interface MessageRow extends RowDataPacket {
    id: DbInteger;
    profile_id: DbInteger;
    body: string;
    attachment_url: string | null;
    attachment_kind: "image" | "gif" | null;
    author_name: string;
    author_avatar: string | null;
    created_at_ms: DbInteger;
}

interface ExistsRow extends RowDataPacket {
    found: number;
}

interface PartyEpisodeRow extends RowDataPacket {
    duration_seconds: string | number | null;
}

export interface ReadyPartyEpisode {
    durationSeconds: number | null;
}

export interface StalePartyMember {
    profileId: number;
    role: WatchPartyRole;
}

const PARTY_COLUMNS = `
    p.id, p.room_code, p.host_profile_id, p.series_key, p.episode_key,
    p.state, p.position_seconds, p.anchor_version, p.control_mode,
    p.buffering_profile_id,
    ROUND(UNIX_TIMESTAMP(p.buffering_started_at) * 1000) AS buffering_started_at_ms,
    ROUND(UNIX_TIMESTAMP(p.buffering_until) * 1000) AS buffering_until_ms,
    ROUND(UNIX_TIMESTAMP(p.buffering_cooldown_until) * 1000) AS buffering_cooldown_until_ms,
    ROUND(UNIX_TIMESTAMP(p.position_updated_at) * 1000) AS position_updated_at_ms,
    ROUND(UNIX_TIMESTAMP(p.created_at) * 1000) AS created_at_ms,
    ROUND(UNIX_TIMESTAMP(p.expires_at) * 1000) AS expires_at_ms,
    ROUND(UNIX_TIMESTAMP(p.closed_at) * 1000) AS closed_at_ms,
    ROUND(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000) AS server_now_ms
`;

const mapParty = (row: PartyRow): WatchParty => ({
    id: parseSafeDbInteger(row.id, "watch_parties.id"),
    roomCode: row.room_code,
    hostProfileId: parseSafeDbInteger(row.host_profile_id, "watch_parties.host_profile_id"),
    seriesKey: row.series_key,
    episodeKey: row.episode_key,
    controlMode: row.control_mode,
    anchor: {
        state: row.state,
        positionSeconds: Number(row.position_seconds),
        anchorAtMs: parseSafeDbInteger(row.position_updated_at_ms, "watch_parties.position_updated_at"),
        anchorVersion: parseSafeDbInteger(row.anchor_version, "watch_parties.anchor_version"),
    },
    bufferingWait: row.buffering_profile_id == null
        || row.buffering_started_at_ms == null
        || row.buffering_until_ms == null
        ? null
        : {
            profileId: parseSafeDbInteger(row.buffering_profile_id, "watch_parties.buffering_profile_id"),
            startedAtMs: parseSafeDbInteger(row.buffering_started_at_ms, "watch_parties.buffering_started_at"),
            timeoutAtMs: parseSafeDbInteger(row.buffering_until_ms, "watch_parties.buffering_until"),
        },
    bufferingCooldownUntilMs: parseNullableSafeDbInteger(
        row.buffering_cooldown_until_ms ?? null,
        "watch_parties.buffering_cooldown_until",
    ),
    createdAtMs: parseSafeDbInteger(row.created_at_ms, "watch_parties.created_at"),
    expiresAtMs: parseSafeDbInteger(row.expires_at_ms, "watch_parties.expires_at"),
    closedAtMs: parseNullableSafeDbInteger(row.closed_at_ms, "watch_parties.closed_at"),
});

const mapSnapshot = (row: PartyRow | undefined): WatchPartySnapshot | null => row === undefined
    ? null
    : { party: mapParty(row), serverNowMs: parseSafeDbInteger(row.server_now_ms, "server_now_ms") };

const safeSeconds = (value: number, field: string): number => {
    if (!Number.isSafeInteger(value) || value < 1 || value > 604_800) {
        throw new Error(`${field} musi być liczbą sekund z zakresu 1-604800.`);
    }
    return value;
};

export const createParty = async (
    input: {
        roomCode: string;
        hostProfileId: number;
        seriesKey: string;
        episodeKey: string;
        positionSeconds?: number;
        ttlSeconds?: number;
    },
    db: Executor = getDbPool(),
): Promise<number> => {
    const ttl = safeSeconds(input.ttlSeconds ?? PARTY_TTL_SECONDS, "ttlSeconds");
    const position = Number.isFinite(input.positionSeconds) && (input.positionSeconds ?? 0) > 0
        ? Math.min(input.positionSeconds as number, 86_400)
        : 0;
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `INSERT INTO watch_parties (room_code, host_profile_id, series_key, episode_key, position_seconds, expires_at)
             VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${ttl} SECOND))`,
            [input.roomCode, input.hostProfileId, input.seriesKey, input.episodeKey, position],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findPartyByCode = async (
    roomCode: string,
    db: Executor = getDbPool(),
): Promise<WatchPartySnapshot | null> => {
    try {
        const [rows] = await db.execute<PartyRow[]>(
            `SELECT ${PARTY_COLUMNS} FROM watch_parties p WHERE p.room_code = ? LIMIT 1`,
            [roomCode],
        );
        return mapSnapshot(rows[0]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findPartyByCodeForUpdate = async (
    roomCode: string,
    db: PoolConnection,
): Promise<WatchPartySnapshot | null> => {
    try {
        const [rows] = await db.execute<PartyRow[]>(
            `SELECT ${PARTY_COLUMNS} FROM watch_parties p WHERE p.room_code = ? LIMIT 1 FOR UPDATE`,
            [roomCode],
        );
        return mapSnapshot(rows[0]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const hasReadyPartyEpisode = async (
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [rows] = await db.execute<ExistsRow[]>(
            `SELECT 1 AS found FROM media_assets
             WHERE series_key = ? AND episode_key = ? AND status = 'ready' LIMIT 1`,
            [seriesKey, episodeKey],
        );
        return rows[0]?.found === 1;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findReadyPartyEpisode = async (
    seriesKey: string,
    episodeKey: string,
    db: Executor = getDbPool(),
): Promise<ReadyPartyEpisode | null> => {
    try {
        const [rows] = await db.execute<PartyEpisodeRow[]>(
            `SELECT duration_seconds FROM media_assets
             WHERE series_key = ? AND episode_key = ? AND status = 'ready' LIMIT 1`,
            [seriesKey, episodeKey],
        );
        const row = rows[0];
        return row === undefined
            ? null
            : { durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds) };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findPartyById = async (
    partyId: number,
    db: Executor = getDbPool(),
): Promise<WatchPartySnapshot | null> => {
    try {
        const [rows] = await db.execute<PartyRow[]>(
            `SELECT ${PARTY_COLUMNS} FROM watch_parties p WHERE p.id = ? LIMIT 1`,
            [partyId],
        );
        return mapSnapshot(rows[0]);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const updatePlaybackAnchor = async (
    input: {
        partyId: number;
        expectedVersion: number;
        anchor: Pick<WatchPartyAnchor, "state" | "positionSeconds">;
        episodeKey?: string;
    },
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_parties
             SET state = ?,
                 position_seconds = ?,
                 episode_key = COALESCE(?, episode_key),
                 position_updated_at = CURRENT_TIMESTAMP(3),
                 anchor_version = anchor_version + 1,
                 buffering_profile_id = NULL,
                 buffering_started_at = NULL,
                 buffering_until = NULL
             WHERE id = ? AND closed_at IS NULL AND anchor_version = ?`,
            [
                input.anchor.state,
                input.anchor.positionSeconds,
                input.episodeKey ?? null,
                input.partyId,
                input.expectedVersion,
            ],
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const updateControlMode = async (
    partyId: number,
    expectedHostProfileId: number,
    controlMode: WatchPartyControlMode,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_parties
             SET control_mode = ?
             WHERE id = ? AND host_profile_id = ? AND closed_at IS NULL`,
            [controlMode, partyId, expectedHostProfileId],
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const extendPartyLifetime = async (
    partyId: number,
    ttlSeconds: number = PARTY_TTL_SECONDS,
    db: Executor = getDbPool(),
): Promise<void> => {
    const ttl = safeSeconds(ttlSeconds, "ttlSeconds");
    try {
        await db.execute(
            `UPDATE watch_parties
             SET expires_at = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${ttl} SECOND)
             WHERE id = ? AND closed_at IS NULL`,
            [partyId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const closeParty = async (partyId: number, db: Executor = getDbPool()): Promise<void> => {
    try {
        await db.execute(
            "UPDATE watch_parties SET closed_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND closed_at IS NULL",
            [partyId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const beginBufferingPause = async (
    partyId: number,
    profileId: number,
    timeoutSeconds: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    const timeout = safeSeconds(timeoutSeconds, "timeoutSeconds");
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_parties
             SET position_seconds = position_seconds + GREATEST(0, TIMESTAMPDIFF(MICROSECOND, position_updated_at, CURRENT_TIMESTAMP(3)) / 1000000),
                 state = 'paused',
                 position_updated_at = CURRENT_TIMESTAMP(3),
                 anchor_version = anchor_version + 1,
                 buffering_profile_id = ?,
                 buffering_started_at = CURRENT_TIMESTAMP(3),
                 buffering_until = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${timeout} SECOND)
             WHERE id = ? AND closed_at IS NULL AND state = 'playing'
               AND buffering_until IS NULL
               AND (buffering_cooldown_until IS NULL OR buffering_cooldown_until <= CURRENT_TIMESTAMP(3))`,
            [profileId, partyId],
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const finishBufferingPause = async (
    partyId: number,
    cooldownSeconds: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    const cooldown = safeSeconds(cooldownSeconds, "cooldownSeconds");
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_parties
             SET state = 'playing',
                 position_updated_at = CURRENT_TIMESTAMP(3),
                 anchor_version = anchor_version + 1,
                 buffering_profile_id = NULL,
                 buffering_started_at = NULL,
                 buffering_until = NULL,
                 buffering_cooldown_until = DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${cooldown} SECOND)
             WHERE id = ? AND closed_at IS NULL AND buffering_until IS NOT NULL`,
            [partyId],
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const clearBufferingPause = async (
    partyId: number,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            `UPDATE watch_parties
             SET buffering_profile_id = NULL, buffering_started_at = NULL, buffering_until = NULL
             WHERE id = ?`,
            [partyId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const transferPartyHost = async (
    partyId: number,
    expectedHostProfileId: number,
    targetProfileId: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_parties p
             SET p.host_profile_id = ?
             WHERE p.id = ? AND p.host_profile_id = ? AND p.closed_at IS NULL
               AND EXISTS (
                   SELECT 1 FROM watch_party_members m
                   WHERE m.party_id = p.id AND m.profile_id = ?
               )`,
            [targetProfileId, partyId, expectedHostProfileId, targetProfileId],
        );
        if (result.affectedRows === 0) return false;
        await db.execute(
            `UPDATE watch_party_members
             SET role = CASE WHEN profile_id = ? THEN 'host' ELSE 'guest' END
             WHERE party_id = ?`,
            [targetProfileId, partyId],
        );
        return true;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const joinParty = async (
    partyId: number,
    profileId: number,
    role: WatchPartyRole,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            `INSERT INTO watch_party_members (party_id, profile_id, role)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE last_seen_at = CURRENT_TIMESTAMP(3), is_buffering = 0`,
            [partyId, profileId, role],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const leaveParty = async (
    partyId: number,
    profileId: number,
    db: Executor = getDbPool(),
): Promise<void> => {
    try {
        await db.execute(
            "DELETE FROM watch_party_members WHERE party_id = ? AND profile_id = ?",
            [partyId, profileId],
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const touchMember = async (
    partyId: number,
    profileId: number,
    isBuffering: boolean,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_party_members
             SET last_seen_at = CURRENT_TIMESTAMP(3), is_buffering = ?
             WHERE party_id = ? AND profile_id = ?`,
            [isBuffering ? 1 : 0, partyId, profileId],
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const heartbeatMember = async (
    partyId: number,
    profileId: number,
    db: Executor = getDbPool(),
): Promise<boolean> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `UPDATE watch_party_members
             SET last_seen_at = CURRENT_TIMESTAMP(3)
             WHERE party_id = ? AND profile_id = ?`,
            [partyId, profileId],
        );
        return result.affectedRows > 0;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const listStaleMembers = async (
    partyId: number,
    timeoutSeconds: number,
    db: Executor = getDbPool(),
): Promise<StalePartyMember[]> => {
    const timeout = safeSeconds(timeoutSeconds, "timeoutSeconds");
    try {
        const [rows] = await db.execute<(RowDataPacket & { profile_id: DbInteger; role: WatchPartyRole })[]>(
            `SELECT profile_id, role
             FROM watch_party_members
             WHERE party_id = ?
               AND last_seen_at < CURRENT_TIMESTAMP(3) - INTERVAL ${timeout} SECOND
             FOR UPDATE`,
            [partyId],
        );
        return rows.map((row) => ({
            profileId: parseSafeDbInteger(row.profile_id, "watch_party_members.profile_id"),
            role: row.role,
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deletePartyMembers = async (
    partyId: number,
    profileIds: number[],
    db: Executor = getDbPool(),
): Promise<number> => {
    if (profileIds.length === 0) return 0;
    if (profileIds.some((profileId) => !Number.isSafeInteger(profileId) || profileId < 1)) {
        throw new Error("Identyfikatory usuwanych uczestników muszą być dodatnimi liczbami całkowitymi.");
    }
    const placeholders = profileIds.map(() => "?").join(", ");
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `DELETE FROM watch_party_members WHERE party_id = ? AND profile_id IN (${placeholders})`,
            [partyId, ...profileIds],
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const listMembers = async (
    partyId: number,
    db: Executor = getDbPool(),
): Promise<WatchPartyMember[]> => {
    try {
        const [rows] = await db.execute<MemberRow[]>(
            `SELECT m.profile_id, m.role, m.is_buffering, pr.name, pr.avatar,
                    ROUND(UNIX_TIMESTAMP(m.joined_at) * 1000) AS joined_at_ms,
                    ROUND(UNIX_TIMESTAMP(m.last_seen_at) * 1000) AS last_seen_at_ms
             FROM watch_party_members m
             INNER JOIN profiles pr ON pr.id = m.profile_id
             WHERE m.party_id = ?
             ORDER BY m.joined_at, m.profile_id`,
            [partyId],
        );
        return rows.map((row) => ({
            profileId: parseSafeDbInteger(row.profile_id, "watch_party_members.profile_id"),
            name: row.name,
            avatar: row.avatar,
            role: row.role,
            joinedAtMs: parseSafeDbInteger(row.joined_at_ms, "watch_party_members.joined_at"),
            lastSeenAtMs: parseSafeDbInteger(row.last_seen_at_ms, "watch_party_members.last_seen_at"),
            isBuffering: Number(row.is_buffering) === 1,
        }));
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findMemberRole = async (
    partyId: number,
    profileId: number,
    db: Executor = getDbPool(),
): Promise<WatchPartyRole | null> => {
    try {
        const [rows] = await db.execute<(RowDataPacket & { role: WatchPartyRole })[]>(
            "SELECT role FROM watch_party_members WHERE party_id = ? AND profile_id = ? LIMIT 1",
            [partyId, profileId],
        );
        return rows[0]?.role ?? null;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

const MESSAGE_COLUMNS = `m.id, m.profile_id, m.body, m.attachment_url, m.attachment_kind,
             pr.name AS author_name, pr.avatar AS author_avatar,
             ROUND(UNIX_TIMESTAMP(m.created_at) * 1000) AS created_at_ms`;

const MESSAGE_SOURCE = `watch_party_messages m INNER JOIN profiles pr ON pr.id = m.profile_id`;

const mapMessage = (row: MessageRow): WatchPartyMessage => ({
    id: parseSafeDbInteger(row.id, "watch_party_messages.id"),
    profileId: parseSafeDbInteger(row.profile_id, "watch_party_messages.profile_id"),
    body: row.body,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    attachmentUrl: row.attachment_url,
    attachmentKind: row.attachment_kind,
    createdAtMs: parseSafeDbInteger(row.created_at_ms, "watch_party_messages.created_at"),
});

export const insertMessage = async (
    partyId: number,
    profileId: number,
    body: string,
    attachment: { url: string; kind: "image" | "gif" } | null = null,
    db: Executor = getDbPool(),
): Promise<number> => {
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `INSERT INTO watch_party_messages (party_id, profile_id, body, attachment_url, attachment_kind)
             VALUES (?, ?, ?, ?, ?)`,
            [partyId, profileId, body, attachment?.url ?? null, attachment?.kind ?? null],
        );
        return result.insertId;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const findMessageById = async (
    messageId: number,
    db: Executor = getDbPool(),
): Promise<WatchPartyMessage | null> => {
    try {
        const [rows] = await db.execute<MessageRow[]>(
            `SELECT ${MESSAGE_COLUMNS}
             FROM ${MESSAGE_SOURCE} WHERE m.id = ? LIMIT 1`,
            [messageId],
        );
        const row = rows[0];
        return row === undefined ? null : mapMessage(row);
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const listRecentMessages = async (
    partyId: number,
    limit: number,
    db: Executor = getDbPool(),
): Promise<WatchPartyMessage[]> => {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new Error("Limit historii wiadomości musi mieścić się w zakresie 1-200.");
    }
    try {
        const [rows] = await db.execute<MessageRow[]>(
            `SELECT ${MESSAGE_COLUMNS}
             FROM ${MESSAGE_SOURCE}
             WHERE m.party_id = ?
             ORDER BY m.id DESC
             LIMIT ${limit}`,
            [partyId],
        );
        return rows.map(mapMessage).reverse();
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const deleteFinishedParties = async (
    retentionSeconds = 86_400,
    limit = 100,
    db: Executor = getDbPool(),
): Promise<number> => {
    const retention = safeSeconds(retentionSeconds, "retentionSeconds");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
        throw new Error("Limit sprzątania pokojów musi mieścić się w zakresie 1-1000.");
    }
    try {
        const [result] = await db.execute<ResultSetHeader>(
            `DELETE FROM watch_parties
             WHERE expires_at < CURRENT_TIMESTAMP(3)
                OR closed_at < CURRENT_TIMESTAMP(3) - INTERVAL ${retention} SECOND
             LIMIT ${limit}`,
        );
        return result.affectedRows;
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
