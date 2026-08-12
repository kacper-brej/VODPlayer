import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { listCollections, getCollectionDetail } from "@/lib/collections/collectionService";
import { type CollectionDetail, type CollectionSummary } from "@/lib/core/contracts";
import { dataEmpty, dataFailure, dataSuccess, type DataResult } from "@/lib/core/dataResult";

export type { CollectionDetail, CollectionSummary };

const loadCollections = async (): Promise<DataResult<CollectionSummary[]>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const collections = await listCollections(user.id, user.username);
        return collections.length === 0 ? dataEmpty(collections) : dataSuccess(collections);
    } catch (error) {
        console.error("listCollections failed:", error);
        return dataFailure("server");
    }
};

export const getCollections = cache(loadCollections);

export const getCollection = cache(async (id: number): Promise<DataResult<CollectionDetail>> => {
    const user = await getSessionUser();
    if (!user) return dataFailure("unauthorized");

    try {
        const result = await getCollectionDetail(user.id, user.username, id);
        if (!result.ok) {
            return dataFailure(result.code === "forbidden" ? "forbidden" : "invalid_response");
        }
        return result.detail.items.length === 0 ? dataEmpty(result.detail) : dataSuccess(result.detail);
    } catch (error) {
        console.error("getCollectionDetail failed:", error);
        return dataFailure("server");
    }
});
