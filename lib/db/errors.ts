import "server-only";

export class DatabaseError extends Error {
    readonly code: string;
    readonly httpStatus: number;

    constructor(code: string, httpStatus: number, message: string) {
        super(message);
        this.name = "DatabaseError";
        this.code = code;
        this.httpStatus = httpStatus;
    }
}

interface MysqlDriverError {
    code?: string;
    errno?: number;
    sqlMessage?: string;
    sqlState?: string;
    message?: string;
}

interface SafeMysqlLogDetails {
    code: string | null;
    errno: number | null;
    sqlState: string | null;
}

const isMysqlDriverError = (error: unknown): error is MysqlDriverError =>
    typeof error === "object" && error !== null && ("code" in error || "errno" in error || "message" in error);

export const mapDatabaseError = (
    error: unknown,
    log: (message: string, details: unknown) => void = console.error,
): DatabaseError => {
    if (error instanceof DatabaseError) return error;

    if (!isMysqlDriverError(error)) {
        log("Nieznany błąd warstwy DB", { type: typeof error });
        return new DatabaseError("unknown", 500, "Wystąpił nieoczekiwany błąd serwera.");
    }

    const safeDetails: SafeMysqlLogDetails = {
        code: typeof error.code === "string" ? error.code : null,
        errno: typeof error.errno === "number" ? error.errno : null,
        sqlState: typeof error.sqlState === "string" ? error.sqlState : null,
    };
    log(`Błąd MySQL ${error.code ?? "?"} (errno ${error.errno ?? "?"})`, safeDetails);

    if (error.code === "POOL_ENQUEUELIMIT" || error.code === "POOL_CLOSED"
        || error.message?.toLowerCase().includes("queue limit")) {
        return new DatabaseError("db_busy", 503, "Baza danych jest chwilowo przeciążona. Spróbuj ponownie za chwilę.");
    }

    switch (error.code) {
        case "ECONNREFUSED":
        case "ETIMEDOUT":
        case "PROTOCOL_CONNECTION_LOST":
            return new DatabaseError(
                "db_unavailable",
                503,
                "Baza danych jest chwilowo niedostępna. Spróbuj ponownie za chwilę.",
            );
        case "ER_ACCESS_DENIED_ERROR":
        case "ER_DBACCESS_DENIED_ERROR":
            return new DatabaseError("db_unavailable", 503, "Baza danych jest chwilowo niedostępna.");
        case "ER_DUP_ENTRY":
            return new DatabaseError("conflict", 409, "Rekord o tych danych już istnieje.");
        case "ER_NO_REFERENCED_ROW_2":
        case "ER_ROW_IS_REFERENCED_2":
            return new DatabaseError("conflict", 409, "Operacja narusza spójność powiązanych danych.");
        default:
            return new DatabaseError("unknown", 500, "Wystąpił nieoczekiwany błąd serwera.");
    }
};
