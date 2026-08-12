import "server-only";

export type EnvSource = Readonly<Record<string, string | undefined>>;

export class EnvironmentConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EnvironmentConfigError";
    }
}

export const requireEnvValue = (env: EnvSource, name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new EnvironmentConfigError(`Brak wymaganej zmiennej środowiskowej: ${name}`);
    return value;
};

export const requireSecret = (
    env: EnvSource,
    name: string,
    minimumBytes = 32,
): string => {
    const value = requireEnvValue(env, name);
    const byteLength = Buffer.byteLength(value, "utf8");
    if (byteLength < minimumBytes) {
        throw new EnvironmentConfigError(`${name} musi mieć co najmniej ${minimumBytes} bajty.`);
    }
    return value;
};

export const parseOptionalBoolean = (
    env: EnvSource,
    name: string,
    defaultValue: boolean,
): boolean => {
    const raw = env[name]?.trim().toLowerCase();
    if (!raw) return defaultValue;
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new EnvironmentConfigError(`${name} musi mieć wartość true albo false.`);
};

export const parseOptionalInteger = (
    env: EnvSource,
    name: string,
    defaultValue: number,
    minimum: number,
    maximum: number,
): number => {
    const raw = env[name]?.trim();
    if (!raw) return defaultValue;
    if (!/^\d+$/u.test(raw)) {
        throw new EnvironmentConfigError(`${name} musi być liczbą całkowitą ${minimum}-${maximum}.`);
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new EnvironmentConfigError(`${name} musi być liczbą całkowitą ${minimum}-${maximum}.`);
    }
    return value;
};

export const requireHttpsUrl = (
    env: EnvSource,
    name: string,
    options: { allowLocalHttp?: boolean } = {},
): string => {
    const raw = requireEnvValue(env, name);
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new EnvironmentConfigError(`${name} musi być poprawnym adresem URL.`);
    }

    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(options.allowLocalHttp && localHost && url.protocol === "http:")) {
        throw new EnvironmentConfigError(`${name} musi używać HTTPS (HTTP jest dozwolone tylko lokalnie).`);
    }
    if (url.username || url.password || url.search || url.hash) {
        throw new EnvironmentConfigError(`${name} nie może zawierać danych logowania, query ani fragmentu.`);
    }
    return url.toString().replace(/\/$/u, "");
};
