import { describe, expect, it, vi } from "vitest";
import { mapDatabaseError } from "../errors";

describe("przeciazenie puli DB", () => {
    it("mapuje kod lub komunikat pelnej kolejki na kontrolowane 503", () => {
        const byCode = mapDatabaseError({ code: "POOL_ENQUEUELIMIT" }, vi.fn());
        const byMessage = mapDatabaseError({ message: "Queue limit reached." }, vi.fn());
        expect(byCode).toMatchObject({ code: "db_busy", httpStatus: 503 });
        expect(byMessage).toMatchObject({ code: "db_busy", httpStatus: 503 });
    });
});
