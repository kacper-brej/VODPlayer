import { beforeEach, describe, expect, it } from "vitest";
import { getDbMetricsSnapshot, observeDbOperation, resetDbMetricsForTests } from "../metrics";

describe("metryki DB", () => {
    beforeEach(resetDbMetricsForTests);

    it("mierzy wyłącznie bezpieczną nazwę operacji, bez SQL i parametrów", async () => {
        await observeDbOperation("catalog.assets", async () => "ok");
        expect(getDbMetricsSnapshot()).toEqual([
            expect.objectContaining({ operation: "catalog.assets", count: 1, failures: 0 }),
        ]);
        await expect(observeDbOperation("SELECT * FROM users", async () => null))
            .rejects.toThrow("invalid_db_metric_operation");
    });

    it("zlicza błąd i przepuszcza oryginalny wyjątek", async () => {
        await expect(observeDbOperation("catalog.assets", async () => { throw new Error("boom"); }))
            .rejects.toThrow("boom");
        expect(getDbMetricsSnapshot()[0]).toMatchObject({ count: 1, failures: 1 });
    });
});
