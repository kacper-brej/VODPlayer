"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getAdminUsers } from "@/lib/admin/adminUserService";
import { getAdminLibrary } from "@/lib/admin/adminLibraryService";
import {
    type AdminLibraryResponse,
    type AdminUsersResponse,
} from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";
import { loadPartyTelemetryOverview, type PartyTelemetryOverview } from "@/lib/party/partyTelemetryService";

export const getAdminLibraryAction = async (): Promise<DataResult<AdminLibraryResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        return dataSuccess(await getAdminLibrary());
    } catch (error) {
        console.error("getAdminLibraryAction failed:", error);
        return dataFailure("server");
    }
};

export const getAdminUsersAction = async (): Promise<DataResult<AdminUsersResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);

    try {
        const users = await getAdminUsers();
        return dataSuccess({ users });
    } catch (error) {
        console.error("getAdminUsersAction failed:", error);
        return dataFailure("server");
    }
};

export const getPartyTelemetryAction = async (): Promise<DataResult<PartyTelemetryOverview>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized", 401);
    if (user.role !== "admin") return dataFailure("forbidden", 403);
    try {
        return dataSuccess(await loadPartyTelemetryOverview());
    } catch (error) {
        console.error("getPartyTelemetryAction failed:", error);
        return dataFailure("server");
    }
};
