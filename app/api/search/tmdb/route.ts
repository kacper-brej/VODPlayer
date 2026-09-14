import { getSessionUser } from "@/lib/auth/session";
import { searchTmdb } from "@/lib/search/searchTmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export const GET = async (request: Request) => {
    try {
        const user = await getSessionUser();
        if (!user) return Response.json([], { status: 401, headers });
        if (request.signal.aborted) return new Response(null, { status: 204, headers });

        const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
        if (query.length < 2 || query.length > 120) return Response.json([], { status: 400, headers });

        return Response.json(await searchTmdb(query, request.signal), { headers });
    } catch (error) {
        console.error("Search request failed", error);
        return Response.json([], { status: 500, headers });
    }
};
