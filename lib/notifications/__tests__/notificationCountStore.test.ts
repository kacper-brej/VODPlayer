import { describe, expect, it, vi } from "vitest";
import { createNotificationCountStore } from "../notificationCountStore";

describe("shared notification count", () => {
    it("shares an in-flight refresh between subscribers", async () => {
        let finish!: (count: number) => void;
        const load = vi.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
        const store = createNotificationCountStore(load);
        const first = vi.fn();
        const second = vi.fn();
        store.subscribe(first);
        const unsubscribe = store.subscribe(second);
        const refresh = store.refresh();
        expect(store.refresh()).toBe(refresh);
        await Promise.resolve();
        expect(load).toHaveBeenCalledTimes(1);
        finish(8);
        await refresh;
        expect(store.getSnapshot()).toBe(8);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        unsubscribe();
        store.update(7);
        expect(first).toHaveBeenCalledTimes(2);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("does not overwrite a newer read event with an old request result", async () => {
        let finish!: (count: number) => void;
        const store = createNotificationCountStore(() => new Promise<number>((resolve) => { finish = resolve; }));
        const pending = store.refresh();
        await Promise.resolve();
        store.update(0);
        finish(8);
        await pending;
        expect(store.getSnapshot()).toBe(0);
    });

    it("retries after failure and retains the known count", async () => {
        const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(5);
        const store = createNotificationCountStore(load);
        store.update(3);
        await store.refresh();
        expect(store.getSnapshot()).toBe(3);
        await store.refresh();
        expect(store.getSnapshot()).toBe(5);
    });

    it("ignores invalid values and does not notify for the same count", () => {
        const store = createNotificationCountStore(async () => 0);
        const changed = vi.fn();
        store.subscribe(changed);
        store.update(5);
        for (const count of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, 5]) store.update(count);
        expect(store.getSnapshot()).toBe(5);
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it("keeps separate account stores isolated", async () => {
        const first = createNotificationCountStore(async () => 8);
        const second = createNotificationCountStore(async () => 2);
        await Promise.all([first.refresh(), second.refresh()]);
        first.update(0);
        expect(second.getSnapshot()).toBe(2);
    });
});
