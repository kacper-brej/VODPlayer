import "server-only";
import { withTransaction } from "@/lib/db/transaction";
import { DatabaseError } from "@/lib/db/errors";
import * as repo from "@/lib/seriesGroups/seriesGroupRepository";

const MAX_BASE_TITLE_LENGTH = 255;
const MIN_SEASON_NUMBER = 1;
const MAX_SEASON_NUMBER = 999;

export interface SeriesGroupMember {
    seriesKey: string;
    seriesId: number;
    seasonNumber: number | null;
}

export interface SeriesGroupWithMembers {
    id: number;
    baseTitle: string;
    createdAt: number;
    series: SeriesGroupMember[];
}

export interface SeriesGroupOrphan extends SeriesGroupMember {
    groupId: number;
}

export interface SeriesGroupsListing {
    groups: SeriesGroupWithMembers[];
    orphans: SeriesGroupOrphan[];
}

export const listGroupsWithMembers = async (): Promise<SeriesGroupsListing> => {
    const [groupRows, memberRows] = await Promise.all([repo.listGroups(), repo.listGroupedSeries()]);

    const groups = new Map<number, SeriesGroupWithMembers>(
        groupRows.map((row) => [row.id, { id: row.id, baseTitle: row.baseTitle, createdAt: row.createdAt, series: [] }]),
    );
    const orphans: SeriesGroupOrphan[] = [];

    for (const row of memberRows) {
        const member: SeriesGroupMember = { seriesKey: row.seriesKey, seriesId: row.seriesId, seasonNumber: row.seasonNumber };
        const group = groups.get(row.groupId);
        if (group) {
            group.series.push(member);
        } else {
            orphans.push({ ...member, groupId: row.groupId });
        }
    }

    return { groups: [...groups.values()], orphans };
};

export interface SeriesGroupOption {
    id: number;
    baseTitle: string;
}

export const listGroupOptions = async (): Promise<SeriesGroupOption[]> => {
    const rows = await repo.listGroups();
    return rows.map((row) => ({ id: row.id, baseTitle: row.baseTitle }));
};

export type CreateGroupResult =
    | { ok: true; id: number; baseTitle: string }
    | { ok: false; code: "invalid" | "server" };

export const createGroup = async (rawBaseTitle: string): Promise<CreateGroupResult> => {
    const baseTitle = rawBaseTitle.trim();
    if (baseTitle === "" || baseTitle.length > MAX_BASE_TITLE_LENGTH) return { ok: false, code: "invalid" };

    try {
        const id = await repo.insertGroup(baseTitle);
        return { ok: true, id, baseTitle };
    } catch (error) {
        if (error instanceof DatabaseError && error.code === "conflict") {
            const existingId = await repo.findGroupIdByBaseTitle(baseTitle);
            if (existingId !== null) return { ok: true, id: existingId, baseTitle };
            return { ok: false, code: "server" };
        }
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

const normalizeSeasonNumber = (raw: unknown): { ok: true; value: number | null } | { ok: false } => {
    if (raw === null || raw === undefined) return { ok: true, value: null };
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < MIN_SEASON_NUMBER || raw > MAX_SEASON_NUMBER) {
        return { ok: false };
    }
    return { ok: true, value: raw };
};

export type AssignSeriesToGroupResult =
    | { ok: true; seriesKey: string; groupId: number | null; seasonNumber: number | null }
    | { ok: false; code: "invalid" | "not_found" | "server" };

export const assignSeriesToGroup = async (
    rawSeriesKey: string,
    rawGroupId: number | null,
    rawSeasonNumber: unknown,
): Promise<AssignSeriesToGroupResult> => {
    const seriesKey = rawSeriesKey.trim();
    if (seriesKey === "") return { ok: false, code: "invalid" };

    const seasonResult = normalizeSeasonNumber(rawSeasonNumber);
    if (!seasonResult.ok) return { ok: false, code: "invalid" };

    if (rawGroupId !== null && (!Number.isInteger(rawGroupId))) return { ok: false, code: "invalid" };

    try {
        const exists = await repo.seriesIdentityExists(seriesKey);
        if (!exists) return { ok: false, code: "not_found" };

        if (rawGroupId !== null) {
            const groupExists = await repo.groupExistsById(rawGroupId);
            if (!groupExists) return { ok: false, code: "not_found" };
        }

        await repo.assignSeriesToGroup(seriesKey, rawGroupId, seasonResult.value);
        return { ok: true, seriesKey, groupId: rawGroupId, seasonNumber: seasonResult.value };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};

export type DissolveGroupResult =
    | { ok: true; groupId: number; releasedSeries: number }
    | { ok: false; code: "invalid" | "not_found" | "server" };

export const dissolveGroup = async (rawGroupId: unknown): Promise<DissolveGroupResult> => {
    if (typeof rawGroupId !== "number" || !Number.isInteger(rawGroupId)) return { ok: false, code: "invalid" };

    try {
        const { released, removed } = await withTransaction(async (connection) => {
            const releasedCount = await repo.releaseSeriesFromGroup(rawGroupId, connection);
            const removedCount = await repo.deleteGroup(rawGroupId, connection);
            return { released: releasedCount, removed: removedCount };
        });

        if (removed === 0) return { ok: false, code: "not_found" };
        return { ok: true, groupId: rawGroupId, releasedSeries: released };
    } catch (error) {
        if (error instanceof DatabaseError) return { ok: false, code: "server" };
        throw error;
    }
};
