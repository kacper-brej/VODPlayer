import { NextResponse } from "next/server";
import { readJsonBodyWithLimit } from "@/lib/http/requestBody";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { listGroupsWithMembers, createGroup, assignSeriesToGroup } from "@/lib/seriesGroups/seriesGroupService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const listing = await listGroupsWithMembers();
    return NextResponse.json(listing);
};

export const POST = async (request: Request) => {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    const baseTitle = payload && typeof payload === "object" && "baseTitle" in payload && typeof payload.baseTitle === "string"
        ? payload.baseTitle
        : "";

    const result = await createGroup(baseTitle);
    if (!result.ok) {
        const status = result.code === "server" ? 500 : 422;
        const message = result.code === "server" ? "Nie udało się utworzyć grupy." : "Nieprawidłowa nazwa grupy.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ id: result.id, baseTitle: result.baseTitle }, { status: 201 });
};

export const PATCH = async (request: Request) => {
    const auth = await requireAdminRoute();
    if (!auth.ok) return auth.response;

    const payload: unknown = await readJsonBodyWithLimit(request).catch(() => null);
    if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    }

    const { seriesKey, groupId, seasonNumber } = payload as Record<string, unknown>;
    if (typeof seriesKey !== "string" || (groupId !== null && typeof groupId !== "number")) {
        return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 422 });
    }

    const result = await assignSeriesToGroup(seriesKey, groupId as number | null, seasonNumber);
    if (!result.ok) {
        const status = result.code === "not_found" ? 404 : result.code === "server" ? 500 : 422;
        const message = result.code === "not_found"
            ? "Nieznany serial lub grupa."
            : result.code === "server"
                ? "Nie udało się przypisać serialu do grupy."
                : "Nieprawidłowe dane.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true, seriesKey: result.seriesKey, groupId: result.groupId, seasonNumber: result.seasonNumber });
};
