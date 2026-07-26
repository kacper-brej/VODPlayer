"use server"
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET);

const getUploadKeyAction = async (): Promise<string | null> => {
    const token = (await cookies()).get("token")?.value;
    if (!token) return null;

    try {
        await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    } catch {
        return null;
    }

    return process.env.UPLOAD_SECRET ?? null;
}

export default getUploadKeyAction;
