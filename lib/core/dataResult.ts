export type DataErrorReason =
    | "unauthorized"
    | "forbidden"
    | "not_configured"
    | "server"
    | "network"
    | "invalid_response";

export type DataFailure = {
    kind: "error";
    reason: DataErrorReason;
    status?: number;
};

export type DataResult<T> =
    | { kind: "success"; data: T }
    | { kind: "empty"; data: T }
    | DataFailure;

export const dataSuccess = <T>(data: T): DataResult<T> => ({
    kind: "success",
    data,
});

export const dataEmpty = <T>(data: T): DataResult<T> => ({
    kind: "empty",
    data,
});

export const dataFailure = (
    reason: DataErrorReason,
    status?: number,
): DataFailure => ({
    kind: "error",
    reason,
    ...(status === undefined ? {} : { status }),
});

export const failureFromStatus = (status: number): DataFailure => {
    if (status === 401) return dataFailure("unauthorized", status);
    if (status === 403) return dataFailure("forbidden", status);
    return dataFailure("server", status);
};
