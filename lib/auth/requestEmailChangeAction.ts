"use server";
import { getSessionUser } from "@/lib/auth/session";
import { requestEmailChange } from "@/lib/auth/accountService";
import { PUBLIC_DEMO_LOCKED_MESSAGE, isPublicDemoAccount } from "@/lib/auth/publicDemoAccount";

type RequestEmailChangeResult =
    | { success: true; message: string }
    | { success: false; error: "unauthenticated" | "backend" | "network" | "invalid_response"; message?: string };

const requestEmailChangeAction = async (email: string): Promise<RequestEmailChangeResult> => {
    const user = await getSessionUser();
    if (!user) return { success: false, error: "unauthenticated" };
    if (isPublicDemoAccount(user)) {
        return { success: false, error: "backend", message: PUBLIC_DEMO_LOCKED_MESSAGE };
    }

    const result = await requestEmailChange(user.id, user.email, email);

    if (!result.ok) {
        const messages: Record<typeof result.code, string> = {
            invalid: "Podaj prawidłowy adres email.",
            conflict: "Ten adres email jest już zajęty albo identyczny z obecnym.",
            server: "Nie udało się zapisać żądania zmiany adresu email.",
        };
        return { success: false, error: "backend", message: messages[result.code] };
    }

    return { success: true, message: "Wysłaliśmy link potwierdzający na nowy adres email." };
};

export default requestEmailChangeAction;
