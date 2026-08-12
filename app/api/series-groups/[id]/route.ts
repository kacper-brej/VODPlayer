import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { parsePositiveId } from "@/lib/http/routeParams";
import { dissolveGroup } from "@/lib/seriesGroups/seriesGroupService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const id = parsePositiveId((await context.params).id);
    if (id === null) return NextResponse.json({ error: "Nieprawidłowy identyfikator grupy." }, { status: 422 });

    const result = await dissolveGroup(id);
    if (!result.ok) {
        const status = result.code === "not_found" ? 404 : result.code === "server" ? 500 : 422;
        const message = result.code === "not_found" ? "Nieznana grupa." : "Nie udało się rozwiązać grupy.";
        return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({ success: true, groupId: result.groupId, releasedSeries: result.releasedSeries });
};
