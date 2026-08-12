import "server-only";
import { EnvironmentConfigError, requireHttpsUrl, requireSecret, type EnvSource } from "@/lib/config/env";

export const readSessionSecret = (env: EnvSource = process.env): string =>
    requireSecret(env, "SESSION_SECRET", 32);

export const readApplicationUrl = (env: EnvSource = process.env): string => {
    const isLocalRuntime = env.NODE_ENV !== "production";
    if (!env.NEXT_PUBLIC_APP_URL?.trim() && isLocalRuntime) return "http://localhost:3000";
    return requireHttpsUrl(env, "NEXT_PUBLIC_APP_URL", { allowLocalHttp: isLocalRuntime });
};

export const isAuthGateDisabled = (env: EnvSource = process.env): boolean => {
    const disabled = env.DISABLE_AUTH_GATE?.trim().toLowerCase();
    if (!disabled || disabled === "false") return false;
    if (disabled !== "true") {
        throw new EnvironmentConfigError("DISABLE_AUTH_GATE musi mieć wartość true albo false.");
    }
    if (env.NODE_ENV === "production") {
        throw new EnvironmentConfigError("DISABLE_AUTH_GATE=true jest zabronione w produkcji.");
    }
    return true;
};
