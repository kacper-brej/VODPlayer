import "server-only";
import { headers } from "next/headers";
import { parseOptionalInteger } from "@/lib/config/env";

export const clientIp = async (): Promise<string> => {
    const headerList = await headers();
    const trustedProxyHops = parseOptionalInteger(process.env, "TRUSTED_PROXY_HOPS", 0, 0, 10);
    if (trustedProxyHops === 0) return "untrusted-proxy";
    const forwardedFor = headerList.get("x-forwarded-for");
    if (!forwardedFor) return "unknown";
    const chain = forwardedFor.split(",").map((value) => value.trim()).filter(Boolean);
    const candidate = chain[chain.length - trustedProxyHops];
    return candidate && candidate.length <= 64 ? candidate : "unknown";
};
