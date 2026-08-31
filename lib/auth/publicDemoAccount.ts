import type { AuthUser } from "@/lib/core/contracts";

export const PUBLIC_DEMO_USERNAME = "example";
export const PUBLIC_DEMO_LOCKED_MESSAGE = "Konto demonstracyjne jest tylko do podglądu.";

export const isPublicDemoAccount = (
    user: Pick<AuthUser, "username"> | null | undefined,
): boolean => user?.username.toLowerCase() === PUBLIC_DEMO_USERNAME;
