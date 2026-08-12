import "server-only";

export type DbInteger = string | number | bigint;

export const parseSafeDbInteger = (value: DbInteger, field: string): number => {
    const parsed = typeof value === "bigint" ? value : BigInt(value);
    if (parsed < BigInt(Number.MIN_SAFE_INTEGER) || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new RangeError(`${field} przekracza bezpieczny zakres liczby JavaScript.`);
    }
    return Number(parsed);
};

export const parseNullableSafeDbInteger = (
    value: DbInteger | null,
    field: string,
): number | null => value === null ? null : parseSafeDbInteger(value, field);
