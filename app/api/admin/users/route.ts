import { NextResponse } from "next/server";
import { requireAdminRoute } from "@/lib/http/routeAuth";
import { getAdminUsers } from "@/lib/admin/adminUserService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
    const gate = await requireAdminRoute();
    if (!gate.ok) return gate.response;

    const users = await getAdminUsers();
    return NextResponse.json({ users });
};
