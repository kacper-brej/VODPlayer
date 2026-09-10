import { describe, expect, it, vi } from "vitest";
import { createProgressQueue } from "../progressQueue";

const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
};

describe("playback progress queue", () => {
    it("continues draining after its caller stops awaiting the save", async () => {
        const queue = createProgressQueue();
        const server = deferred();
        const saved: number[] = [];
        void queue.enqueue("episode-a", async () => {
            await server.promise;
            saved.push(12);
        });
        await Promise.resolve();
        void queue.enqueue("episode-a", () => { saved.push(18); });
        expect(saved).toEqual([]);
        server.resolve();
        await queue.flush();
        expect(saved).toEqual([12, 18]);
    });

    it("keeps the final position of each episode while coalescing updates", async () => {
        const queue = createProgressQueue();
        const server = deferred();
        const saved: string[] = [];
        void queue.enqueue("episode-a", () => server.promise);
        await Promise.resolve();
        void queue.enqueue("episode-a", () => { saved.push("a:18"); });
        void queue.enqueue("episode-a", () => { saved.push("a:24"); });
        void queue.enqueue("episode-b", () => { saved.push("b:5"); });
        server.resolve();
        await queue.flush();

        expect(saved).toEqual(["a:24", "b:5"]);
    });

    it("does not discard later episodes when an update throws", async () => {
        const queue = createProgressQueue();
        const saved = vi.fn();
        void queue.enqueue("episode-a", async () => { throw new Error("offline"); });
        void queue.enqueue("episode-b", saved);
        await queue.flush();

        expect(saved).toHaveBeenCalledOnce();
    });

    it("starts a new drain after the previous batch has completed", async () => {
        const queue = createProgressQueue();
        const first = vi.fn();
        const second = vi.fn();
        await queue.enqueue("episode-a", first);
        await queue.enqueue("episode-b", second);

        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledOnce();
    });
});
