import { describe, expect, it, vi } from "vitest";
import { DatabaseError, mapDatabaseError } from "../errors";

describe("mapDatabaseError", () => {
    it("mapuje utratę połączenia na 503 db_unavailable bez ujawniania szczegółów sterownika", () => {
        const log = vi.fn();
        const driverError = {
            code: "ECONNREFUSED",
            errno: -111,
            sqlMessage: "połączenie z 10.0.0.5:3306 odrzucone",
        };

        const result = mapDatabaseError(driverError, log);

        expect(result).toBeInstanceOf(DatabaseError);
        expect(result.code).toBe("db_unavailable");
        expect(result.httpStatus).toBe(503);
        expect(result.message).not.toContain("10.0.0.5");
        expect(result.message).not.toContain(driverError.sqlMessage);
        expect(log).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"), {
            code: "ECONNREFUSED",
            errno: -111,
            sqlState: null,
        });
        expect(JSON.stringify(log.mock.calls)).not.toContain("10.0.0.5");
        expect(JSON.stringify(log.mock.calls)).not.toContain(driverError.sqlMessage);
    });

    it("mapuje błędne poświadczenia na 503 ogólny, nie na komunikat sugerujący login/hasło", () => {
        const result = mapDatabaseError({ code: "ER_ACCESS_DENIED_ERROR", errno: 1045 }, vi.fn());
        expect(result.httpStatus).toBe(503);
        expect(result.message.toLowerCase()).not.toContain("hasł");
        expect(result.message.toLowerCase()).not.toContain("login");
        expect(result.message.toLowerCase()).not.toContain("user");
    });

    it("mapuje duplikat klucza na 409 conflict", () => {
        const result = mapDatabaseError({ code: "ER_DUP_ENTRY", errno: 1062 }, vi.fn());
        expect(result.code).toBe("conflict");
        expect(result.httpStatus).toBe(409);
    });

    it("mapuje naruszenie FK na 409 conflict", () => {
        const insert = mapDatabaseError({ code: "ER_NO_REFERENCED_ROW_2", errno: 1452 }, vi.fn());
        const del = mapDatabaseError({ code: "ER_ROW_IS_REFERENCED_2", errno: 1451 }, vi.fn());
        expect(insert.httpStatus).toBe(409);
        expect(del.httpStatus).toBe(409);
    });

    it("nieznany kod błędu sterownika -> 500 unknown", () => {
        const result = mapDatabaseError({ code: "ER_SOMETHING_NEW", errno: 9999 }, vi.fn());
        expect(result.code).toBe("unknown");
        expect(result.httpStatus).toBe(500);
    });

    it("DatabaseError przepuszczona bez zmian -> nie traci kodu przy powtórnym mapowaniu (np. przez withTransaction)", () => {
        const original = new DatabaseError("conflict", 409, "Rekord o tych danych już istnieje.");
        const result = mapDatabaseError(original, vi.fn());
        expect(result).toBe(original);
        expect(result.code).toBe("conflict");
        expect(result.httpStatus).toBe(409);
    });

    it("wartość, która nie wygląda jak błąd sterownika mysql2 -> 500 bez logowania jej treści", () => {
        const log = vi.fn();
        const result = mapDatabaseError("sekret-do-ukrycia", log);
        expect(result.httpStatus).toBe(500);
        expect(log).toHaveBeenCalledWith("Nieznany błąd warstwy DB", { type: "string" });
        expect(JSON.stringify(log.mock.calls)).not.toContain("sekret-do-ukrycia");
    });
});
