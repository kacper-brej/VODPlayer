"use server";
import { jwtVerify } from "jose";
import { VOD_ORIGIN, sessionToken } from "@/lib/vodConfig";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

type RequestPasswordChangeResult =
    | { success: true }
    | { success: false; error: "unauthenticated" | "backend" | "network" };

const requestPasswordChangeAction = async (): Promise<RequestPasswordChangeResult> => {
    const token = await sessionToken();

    if (!token) return { success: false, error: "unauthenticated" };

    let email: string | null = null;

    try {
        const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
        email = typeof payload.email === "string" ? payload.email : null;
    } catch {
        return { success: false, error: "unauthenticated" };
    }

    if (!email) return { success: false, error: "unauthenticated" };

    try {
        const res = await fetch(`${VOD_ORIGIN}/forgot-password.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ email }),
        });

        if (!res.ok) {
            console.error("forgot-password.php ->", res.status, await res.text());
            return { success: false, error: "backend" };
        }

        return { success: true };
    } catch (error) {
        console.error("requestPasswordChangeAction failed", error);
        return { success: false, error: "network" };
    }
};

export default requestPasswordChangeAction;
