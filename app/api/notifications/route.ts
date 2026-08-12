import { NextResponse } from "next/server";
import { requireSessionRoute } from "@/lib/http/routeAuth";
import { getNotifications } from "@/lib/notifications/notificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireSessionRoute();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const notifications = await getNotifications(user.id, user.username);
    return NextResponse.json(notifications);
};
