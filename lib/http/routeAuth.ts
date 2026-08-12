import "server-only";
import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/core/contracts";
import { AuthError, requireAdmin, requireUser } from "@/lib/auth/session";

export type RouteGate =
    | { ok: true; user: AuthUser }
    | { ok: false; response: NextResponse };

const gateFrom = async (resolve: () => Promise<AuthUser>): Promise<RouteGate> => {
    try {
        return { ok: true, user: await resolve() };
    } catch (error) {
        if (error instanceof AuthError) {
            return {
                ok: false,
                response: NextResponse.json({ error: error.message }, { status: error.httpStatus }),
            };
        }
        throw error;
    }
};

export const requireSessionRoute = (): Promise<RouteGate> => gateFrom(requireUser);

export const requireAdminRoute = (): Promise<RouteGate> => gateFrom(requireAdmin);
