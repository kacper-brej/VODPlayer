import { requireSessionRoute } from "@/lib/http/routeAuth";
import { resolveWatchData } from "@/lib/player/resolveWatchData";
import { withRequestReadScope } from "@/lib/http/requestReadScope";
import { withServerTiming } from "@/lib/http/serverTiming";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
});

export const GET = (request: Request) => withRequestReadScope(() => withServerTiming(async (timing) => {
    const gate = await timing.measure("session", requireSessionRoute);
    if (!gate.ok) return gate.response;

    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const ep = params.get("ep");
    if (!id || !ep || id.length > 255 || ep.length > 255) {
        return json({ error: "Nieprawidłowy odcinek." }, 400);
    }

    try {
        // Use the same access checks, demo fallback and resume data as the watch page.
        const result = await timing.measure("watch_data", () => resolveWatchData(id, ep));
        if (result.kind === "not-found") return json({ error: "Nie znaleziono serialu." }, 404);
        if (result.kind === "error") return json({ error: result.message }, result.status);
        if (result.kind === "data-error") {
            const status = result.reason === "unauthorized" ? 401 : result.reason === "forbidden" ? 403 : 503;
            return json({ error: "Nie udało się wczytać odcinka. Spróbuj ponownie." }, status);
        }
        return json(result.data);
    } catch {
        return json({ error: "Nie udało się wczytać odcinka. Spróbuj ponownie." }, 503);
    }
}));
