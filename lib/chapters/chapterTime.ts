/** Accepts a playback timestamp, never an ambiguous bare number of seconds. */
export const parseChapterTime = (value: string): number | null => {
    const text = value.trim();
    if (!/^\d{1,6}:[0-5]\d(?::[0-5]\d)?$/.test(text)) return null;
    const parts = text.split(":").map(Number);
    if (parts.length === 3 && parts[1] > 59) return null;
    const seconds = parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];
    return Number.isSafeInteger(seconds) && seconds <= 2147483647 ? seconds : null;
};

export const formatChapterTime = (seconds: number): string => {
    const value = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainder = String(value % 60).padStart(2, "0");
    return hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
        : `${String(minutes).padStart(2, "0")}:${remainder}`;
};
