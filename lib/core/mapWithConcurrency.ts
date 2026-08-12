export const mapWithConcurrency = async <T, R>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new RangeError("invalid_concurrency");
    const results = new Array<R>(items.length);
    let cursor = 0;

    const run = async (): Promise<void> => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await worker(items[index]!, index);
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
    return results;
};
