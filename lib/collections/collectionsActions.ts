"use server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import * as service from "@/lib/collections/collectionService";
import {
    type AddCollectionItemResponse,
    type CreateCollectionResponse,
    type DeleteCollectionResponse,
    type RemoveCollectionItemResponse,
    type RenameCollectionResponse,
} from "@/lib/core/contracts";
import { dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export const createCollectionAction = async (name: string): Promise<DataResult<CreateCollectionResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await service.createCollection(user.id, user.username, name);
    if (!result.ok) {
        return dataFailure(
            result.code === "limit" || result.code === "conflict" || result.code === "invalid"
                ? "invalid_response"
                : "server",
        );
    }

    revalidatePath("/collections");
    return dataSuccess({ id: result.id, name: result.name, createdAt: result.createdAt });
};

export const renameCollectionAction = async (
    collectionId: number,
    name: string,
): Promise<DataResult<RenameCollectionResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await service.renameCollection(user.id, user.username, collectionId, name);
    if (!result.ok) {
        return dataFailure(result.code === "forbidden" ? "forbidden" : "invalid_response");
    }

    revalidatePath("/collections");
    return dataSuccess({ id: result.id, name: result.name });
};

export const deleteCollectionAction = async (collectionId: number): Promise<DataResult<DeleteCollectionResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await service.deleteCollection(user.id, user.username, collectionId);
    if (!result.ok) {
        return dataFailure(result.code === "forbidden" ? "forbidden" : "invalid_response");
    }

    revalidatePath("/collections");
    return dataSuccess({ success: true });
};

export const addToCollectionAction = async (
    collectionId: number,
    seriesKey: string,
): Promise<DataResult<AddCollectionItemResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await service.addToCollection(user.id, user.username, collectionId, seriesKey);
    if (!result.ok) {
        return dataFailure(result.code === "forbidden" ? "forbidden" : "invalid_response");
    }

    revalidatePath("/collections");
    return dataSuccess({ success: true, seriesKey: result.seriesKey });
};

export const removeFromCollectionAction = async (
    collectionId: number,
    seriesKey: string,
): Promise<DataResult<RemoveCollectionItemResponse>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    const result = await service.removeFromCollection(user.id, user.username, collectionId, seriesKey);
    if (!result.ok) {
        return dataFailure(result.code === "forbidden" ? "forbidden" : "invalid_response");
    }

    revalidatePath("/collections");
    return dataSuccess({ success: true });
};
