import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type {
    ArtworkCandidateWrite,
    ExternalIdWrite,
    MatchSource,
    MetadataReviewSnapshotItem,
    ReviewDecisionWrite,
    SeriesMetadataLookup,
    SeriesTitleWrite,
} from "@/lib/seriesMetadata/seriesMetadataContracts";
import type { MetadataArtworkOption } from "@/lib/upload/uploadWorkflowTypes";

type Executor = Pool | PoolConnection;

interface IdentityRow extends RowDataPacket {
    series_key: string;
    group_id: number | null;
    season_number: number | null;
    review_state: "pending" | "skipped" | null;
    review_reason: string | null;
}

interface ExternalIdRow extends RowDataPacket {
    series_key: string;
    provider: string;
    external_id: string;
    match_source: MatchSource;
}

interface ArtworkRow extends RowDataPacket {
    id: number;
    series_key: string;
    kind: "poster" | "backdrop" | "logo";
    url: string;
    width: number | null;
    height: number | null;
    provider: string;
    language: string | null;
    is_primary: number;
    match_source: MatchSource;
}

interface TitleRow extends RowDataPacket { title: string; kind: SeriesTitleWrite["kind"] }
interface DecisionRow extends RowDataPacket { state: "pending" | "skipped"; reason: string | null }
interface KindRow extends RowDataPacket { kind: "poster" | "backdrop" | "logo" }
interface IdRow extends RowDataPacket { id: number }
interface MatchSourceRow extends RowDataPacket { match_source: MatchSource }

const lockSeriesIdentity = async (seriesKey: string, db: Executor): Promise<void> => {
    await db.execute(
        "SELECT series_key FROM series_identities WHERE series_key = ? LIMIT 1 FOR UPDATE",
        [seriesKey],
    );
};

const mapArtwork = (row: ArtworkRow): MetadataArtworkOption => ({
    id: Number(row.id),
    kind: row.kind,
    url: row.url,
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    provider: row.provider,
    language: row.language,
    isPrimary: Boolean(row.is_primary),
    matchSource: row.match_source,
});

export const loadMetadataReviewSnapshot = async (
    db: Executor = getDbPool(),
): Promise<MetadataReviewSnapshotItem[]> => {
    try {
        const [identityResult, externalResult, artworkResult] = await Promise.all([
            db.execute<IdentityRow[]>(
                `SELECT i.series_key, i.group_id, i.season_number,
                        d.state AS review_state, d.reason AS review_reason
                 FROM series_identities i
                 LEFT JOIN metadata_review_decisions d ON d.series_key = i.series_key
                 ORDER BY i.series_key`,
            ),
            db.execute<ExternalIdRow[]>(
                "SELECT series_key, provider, external_id, match_source FROM series_external_ids",
            ),
            db.execute<ArtworkRow[]>(
                `SELECT id, series_key, kind, url, width, height, provider, language, is_primary, match_source
                 FROM series_artwork ORDER BY kind, is_primary DESC, provider, id`,
            ),
        ]);

        const items = new Map<string, MetadataReviewSnapshotItem>(identityResult[0].map((row) => [row.series_key, {
            seriesKey: row.series_key,
            groupId: row.group_id === null ? null : Number(row.group_id),
            seasonNumber: row.season_number === null ? null : Number(row.season_number),
            reviewState: row.review_state,
            reviewReason: row.review_reason,
            externalIds: {},
            externalIdSources: {},
            artwork: [],
        }]));

        for (const row of externalResult[0]) {
            const item = items.get(row.series_key);
            if (!item) continue;
            item.externalIds[row.provider] = row.external_id;
            item.externalIdSources[row.provider] = row.match_source;
        }
        for (const row of artworkResult[0]) items.get(row.series_key)?.artwork.push(mapArtwork(row));
        return [...items.values()];
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const loadSeriesMetadata = async (
    seriesKey: string,
    db: Executor = getDbPool(),
): Promise<SeriesMetadataLookup> => {
    try {
        const [externalResult, titleResult, artworkResult, decisionResult] = await Promise.all([
            db.execute<ExternalIdRow[]>(
                "SELECT series_key, provider, external_id, match_source FROM series_external_ids WHERE series_key = ?",
                [seriesKey],
            ),
            db.execute<TitleRow[]>("SELECT title, kind FROM series_titles WHERE series_key = ?", [seriesKey]),
            db.execute<ArtworkRow[]>(
                `SELECT id, series_key, kind, url, width, height, provider, language, is_primary, match_source
                 FROM series_artwork WHERE series_key = ? ORDER BY kind, is_primary DESC, provider, id`,
                [seriesKey],
            ),
            db.execute<DecisionRow[]>(
                "SELECT state, reason FROM metadata_review_decisions WHERE series_key = ? LIMIT 1",
                [seriesKey],
            ),
        ]);
        const externalIds: Record<string, string> = {};
        const externalIdSources: Record<string, MatchSource> = {};
        for (const row of externalResult[0]) {
            externalIds[row.provider] = row.external_id;
            externalIdSources[row.provider] = row.match_source;
        }
        const decision = decisionResult[0][0];
        return {
            seriesKey,
            externalIds,
            externalIdSources,
            titles: titleResult[0].map((row) => ({ title: row.title, kind: row.kind })),
            artwork: artworkResult[0].map(mapArtwork),
            reviewDecision: decision ? { state: decision.state, reason: decision.reason } : null,
        };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export const upsertExternalId = async (
    seriesKey: string,
    input: ExternalIdWrite,
    db: Executor,
): Promise<void> => {
    await db.execute(
        `INSERT INTO series_external_ids (series_key, provider, external_id, match_source, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE external_id = VALUES(external_id),
           match_source = VALUES(match_source), updated_at = NOW()`,
        [seriesKey, input.provider, input.externalId, input.matchSource],
    );
};

export const upsertTitles = async (
    seriesKey: string,
    titles: SeriesTitleWrite[],
    db: Executor,
): Promise<void> => {
    for (const item of titles) {
        await db.execute(
            `INSERT INTO series_titles (series_key, title, kind, updated_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE kind = VALUES(kind), updated_at = NOW()`,
            [seriesKey, item.title, item.kind],
        );
    }
};

export const upsertArtworkCandidates = async (
    seriesKey: string,
    artwork: ArtworkCandidateWrite[],
    db: Executor,
): Promise<void> => {
    await lockSeriesIdentity(seriesKey, db);
    for (const item of artwork) {
        const [primaryRows] = await db.execute<MatchSourceRow[]>(
            `SELECT match_source FROM series_artwork
             WHERE series_key = ? AND kind = ? AND is_primary = 1 LIMIT 1 FOR UPDATE`,
            [seriesKey, item.kind],
        );
        const existing = primaryRows[0];
        const existingIsManual = existing?.match_source === "manual";
        let isPrimary = 0;

        if (item.primary === "force" && !existingIsManual) {
            await db.execute(
                `UPDATE series_artwork SET is_primary = 0
                 WHERE series_key = ? AND kind = ? AND match_source != 'manual'`,
                [seriesKey, item.kind],
            );
            isPrimary = 1;
        } else if (item.primary === "if-absent" && !existing) {
            isPrimary = 1;
        }

        await db.execute(
            `INSERT INTO series_artwork
                (series_key, kind, url, width, height, provider, language, is_primary,
                 match_source, dominant_color, placeholder, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE width = VALUES(width), height = VALUES(height),
               language = VALUES(language),
               is_primary = CASE WHEN match_source = 'manual' THEN is_primary ELSE VALUES(is_primary) END,
               match_source = CASE WHEN match_source = 'manual' THEN match_source ELSE VALUES(match_source) END,
               dominant_color = COALESCE(VALUES(dominant_color), dominant_color),
               placeholder = COALESCE(VALUES(placeholder), placeholder), updated_at = NOW()`,
            [seriesKey, item.kind, item.url, item.width, item.height, item.provider, item.language,
                isPrimary, item.matchSource, item.dominantColor, item.placeholder],
        );
    }
};

export const upsertReviewDecision = async (
    seriesKey: string,
    decision: ReviewDecisionWrite,
    db: Executor,
): Promise<void> => {
    const sql = decision.preserveSkipped
        ? `INSERT INTO metadata_review_decisions (series_key, state, reason, updated_at)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE state = IF(state = 'skipped', state, VALUES(state)),
             reason = IF(state = 'skipped', reason, VALUES(reason)),
             updated_at = IF(state = 'skipped', updated_at, NOW())`
        : `INSERT INTO metadata_review_decisions (series_key, state, reason, updated_at)
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE state = VALUES(state), reason = VALUES(reason), updated_at = NOW()`;
    await db.execute(sql, [seriesKey, decision.state, decision.reason]);
};

export const selectArtworkForUpdate = async (
    seriesKey: string,
    artworkId: number,
    db: Executor,
): Promise<KindRow["kind"] | null> => {
    await lockSeriesIdentity(seriesKey, db);
    const [rows] = await db.execute<KindRow[]>(
        "SELECT kind FROM series_artwork WHERE id = ? AND series_key = ? LIMIT 1 FOR UPDATE",
        [artworkId, seriesKey],
    );
    return rows[0]?.kind ?? null;
};

export const setPrimaryArtwork = async (
    seriesKey: string,
    artworkId: number,
    kind: KindRow["kind"],
    db: Executor,
): Promise<void> => {
    await db.execute("UPDATE series_artwork SET is_primary = 0 WHERE series_key = ? AND kind = ?", [seriesKey, kind]);
    await db.execute(
        "UPDATE series_artwork SET is_primary = 1, match_source = 'manual', updated_at = NOW() WHERE id = ?",
        [artworkId],
    );
};

export const clearManualMetadata = async (seriesKey: string, db: Executor): Promise<void> => {
    await lockSeriesIdentity(seriesKey, db);
    await db.execute("DELETE FROM series_external_ids WHERE series_key = ? AND match_source = 'manual'", [seriesKey]);
    await db.execute(
        `UPDATE series_artwork SET is_primary = 0,
           match_source = CASE WHEN provider = 'manual' THEN 'manual' ELSE 'auto' END
         WHERE series_key = ? AND match_source = 'manual'`,
        [seriesKey],
    );
    await db.execute("DELETE FROM metadata_review_decisions WHERE series_key = ?", [seriesKey]);
};

export const restorePreferredArtwork = async (
    seriesKey: string,
    kind: "poster" | "backdrop" | "logo",
    db: Executor,
): Promise<void> => {
    const [rows] = await db.execute<IdRow[]>(
        `SELECT id FROM series_artwork WHERE series_key = ? AND kind = ?
         ORDER BY match_source = 'auto' DESC, provider = 'tmdb' DESC, id ASC LIMIT 1`,
        [seriesKey, kind],
    );
    if (rows[0]) await db.execute("UPDATE series_artwork SET is_primary = 1 WHERE id = ?", [rows[0].id]);
};
