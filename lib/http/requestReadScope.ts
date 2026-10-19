import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Only activated by read-only request handlers. Never cache across HTTP requests.
const readScope = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

export const withRequestReadScope = <T>(work: () => Promise<T>): Promise<T> =>
    readScope.run(new Map(), work);

export const reuseRequestRead = <T>(key: string, read: () => Promise<T>): Promise<T> => {
    const values = readScope.getStore();
    if (!values) return read();
    const pending = values.get(key);
    if (pending) return pending as Promise<T>;
    const result = Promise.resolve().then(read);
    values.set(key, result);
    return result;
};
