import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { CATALOG_TAG } from "@/lib/core/vodConfig";
import { deleteMedia } from "@/lib/admin/mediaDeleteService";
import { DeleteB2ConfigError } from "@/lib/admin/b2AdminStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = async (
    _request: Request,
    { params }: { params: Promise<{ seriesKey: string; episodeKey: string }> },
) => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    try {
        const { seriesKey, episodeKey } = await params;
        const result = await deleteMedia(seriesKey, episodeKey);
        if (!result.ok) return NextResponse.json({ error: "Nieprawidłowy seriesKey/episodeKey." }, { status: 422 });
        revalidateTag(CATALOG_TAG, "max");
        return NextResponse.json({
            success: true,
            deletedB2Objects: result.deletedB2Objects,
        });
    } catch (error) {
        if (error instanceof DeleteB2ConfigError) {
            return NextResponse.json({ error: "Brak konfiguracji bezpiecznego klienta B2 delete." }, { status: 503 });
        }
        console.error("DELETE /api/admin/media failed", error);
        return NextResponse.json({ error: "Nie udało się usunąć materiału." }, { status: 500 });
    }
};
