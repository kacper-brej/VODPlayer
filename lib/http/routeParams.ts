export const parsePositiveId = (raw: string): number | null => {
    const id = Number(raw);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const parseStringParam = (raw: string, maxLength = 255): string | null => {
    if (!Number.isSafeInteger(maxLength) || maxLength < 1) return null;
    const value = raw.trim();
    if (value === "" || value.length > maxLength || /[\u0000-\u001F\u007F]/u.test(value)) return null;
    return value;
};
