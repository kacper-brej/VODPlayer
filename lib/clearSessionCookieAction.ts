"use server"
import { cookies } from "next/headers";

const clearSessionCookieAction = async (): Promise<void> => {
    (await cookies()).delete("token");
}

export default clearSessionCookieAction;
