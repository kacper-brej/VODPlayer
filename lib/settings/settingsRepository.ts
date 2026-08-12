import "server-only";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getDbPool } from "@/lib/db/pool";
import { mapDatabaseError } from "@/lib/db/errors";
import type { ProfileSettings } from "@/lib/core/contracts";

type Executor = Pool | PoolConnection;

interface SettingsSqlRow extends RowDataPacket {
    autoplay_next: number;
    auto_previews_enabled: number;
    skip_intro_prompt: number;
    preferred_subtitle_lang: string | null;
    preferred_audio_lang: string | null;
    default_volume: number;
    reduce_data: number;
}

export const getProfileSettingsRow = async (
    profileId: number,
    db: Executor = getDbPool(),
): Promise<ProfileSettings | null> => {
    try {
        const [rows] = await db.execute<SettingsSqlRow[]>(
            `SELECT autoplay_next, auto_previews_enabled, skip_intro_prompt, preferred_subtitle_lang, preferred_audio_lang, default_volume, reduce_data
             FROM profile_settings
             WHERE profile_id = ?
             LIMIT 1`,
            [profileId],
        );
        const row = rows[0];
        if (!row) return null;

        return {
            autoplayNext: row.autoplay_next === 1,
            autoPreviewsEnabled: row.auto_previews_enabled === 1,
            skipIntroPrompt: row.skip_intro_prompt === 1,
            preferredSubtitleLang: row.preferred_subtitle_lang,
            preferredAudioLang: row.preferred_audio_lang,
            defaultVolume: row.default_volume,
            reduceData: row.reduce_data === 1,
        };
    } catch (error) {
        throw mapDatabaseError(error);
    }
};

export interface SettingsColumnUpdates {
    autoplay_next?: number;
    auto_previews_enabled?: number;
    skip_intro_prompt?: number;
    preferred_subtitle_lang?: string | null;
    preferred_audio_lang?: string | null;
    default_volume?: number;
    reduce_data?: number;
}

const DEFAULT_SETTINGS_COLUMNS: Required<SettingsColumnUpdates> = {
    autoplay_next: 1,
    auto_previews_enabled: 1,
    skip_intro_prompt: 1,
    preferred_subtitle_lang: null,
    preferred_audio_lang: null,
    default_volume: 100,
    reduce_data: 0,
};

export const upsertProfileSettings = async (
    profileId: number,
    updates: SettingsColumnUpdates,
    db: Executor = getDbPool(),
): Promise<void> => {
    const insertColumns: Record<string, string | number | null> = {
        ...DEFAULT_SETTINGS_COLUMNS,
        ...updates,
        profile_id: profileId,
    };
    const columnNames = Object.keys(insertColumns);
    const placeholders = columnNames.map(() => "?").join(", ");
    const updateClauses = Object.keys(updates).map((column) => `${column} = VALUES(${column})`);
    updateClauses.push("updated_at = NOW()");

    try {
        await db.execute(
            `INSERT INTO profile_settings (${columnNames.join(", ")}, updated_at)
             VALUES (${placeholders}, NOW())
             ON DUPLICATE KEY UPDATE ${updateClauses.join(", ")}`,
            Object.values(insertColumns),
        );
    } catch (error) {
        throw mapDatabaseError(error);
    }
};
