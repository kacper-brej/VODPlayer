const BYTES_PER_KILOBYTE = 1_000;
const BYTES_PER_MEGABYTE = 1_000_000;
const BYTES_PER_GIGABYTE = 1_000_000_000;

export const B2_FREE_TIER_STORAGE_GB = 10;
export const B2_STORAGE_PRICE_PER_GB_MONTH_USD = 0.00695;

export const formatB2Bytes = (bytes: number, gigabyteDigits = 1): string => {
    if (bytes >= BYTES_PER_GIGABYTE) {
        return `${(bytes / BYTES_PER_GIGABYTE).toFixed(gigabyteDigits)} GB`;
    }
    if (bytes >= BYTES_PER_MEGABYTE) return `${(bytes / BYTES_PER_MEGABYTE).toFixed(1)} MB`;
    return `${(bytes / BYTES_PER_KILOBYTE).toFixed(0)} KB`;
};

export const estimateB2MonthlyStorageCostUsd = (totalBytes: number): number => {
    const freeTierBytes = B2_FREE_TIER_STORAGE_GB * BYTES_PER_GIGABYTE;
    const billableGigabytes = Math.max(0, totalBytes - freeTierBytes) / BYTES_PER_GIGABYTE;
    return billableGigabytes * B2_STORAGE_PRICE_PER_GB_MONTH_USD;
};

export const getB2FreeTierUsedPercent = (totalBytes: number): number => {
    const freeTierBytes = B2_FREE_TIER_STORAGE_GB * BYTES_PER_GIGABYTE;
    return Math.min(100, Math.round((totalBytes / freeTierBytes) * 100));
};
