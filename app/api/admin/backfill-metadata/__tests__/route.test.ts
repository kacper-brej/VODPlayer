import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextResponse } from "next/server";

const requireAdminRoute = vi.fn();
const backfillCatalogMetadataAction = vi.fn();

vi.mock("@/lib/http/routeAuth", () => ({ requireAdminRoute }));
vi.mock("@/lib/admin/backfillCatalogMetadataAction", () => ({ default: backfillCatalogMetadataAction }));
vi.mock("@/lib/admin/jobLock", () => ({
    AdminJobAlreadyRunningError: class extends Error {},
    withAdminJobLock: (_name: string, operation: () => Promise<unknown>) => operation(),
}));

const { POST } = await import("../route");

beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

const request = () => new Request("http://localhost:3000/api/admin/backfill-metadata", {
    method: "POST",
    headers: { Origin: "http://localhost:3000" },
});

const blockedGate = (status: number) => ({
    ok: false,
    response: NextResponse.json({ error: "blocked" }, { status }),
});

describe("POST /api/admin/backfill-metadata", () => {
    it("oddaje odpowiedź 401 z gate'u bez sesji", async () => {
        requireAdminRoute.mockResolvedValue(blockedGate(401));
        const response = await POST(request());
        expect(response.status).toBe(401);
        expect(backfillCatalogMetadataAction).not.toHaveBeenCalled();
    });

    it("oddaje odpowiedź 403 z gate'u użytkownikowi bez roli administratora", async () => {
        requireAdminRoute.mockResolvedValue(blockedGate(403));
        const response = await POST(request());
        expect(response.status).toBe(403);
        expect(backfillCatalogMetadataAction).not.toHaveBeenCalled();
    });

    it("uruchamia backfill administratorowi", async () => {
        requireAdminRoute.mockResolvedValue({ ok: true, user: { id: 2, role: "admin" } });
        backfillCatalogMetadataAction.mockResolvedValue({ kind: "success", data: [] });
        const response = await POST(request());
        expect(response.status).toBe(200);
        expect(backfillCatalogMetadataAction).toHaveBeenCalledOnce();
    });
});
