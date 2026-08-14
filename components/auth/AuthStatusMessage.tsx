import { CircleAlert, CircleCheck } from "lucide-react";

type AuthStatusMessageProps = {
    status: "success" | "error" | null;
    message: string;
};

export function AuthStatusMessage({ status, message }: AuthStatusMessageProps) {
    return (
        <div aria-live={status === "error" ? "assertive" : "polite"} className={status && message ? "mt-2.5" : undefined}>
            {status && message && (
                <div
                    role={status === "error" ? "alert" : "status"}
                    className={`flex gap-2.5 rounded-xl border px-3 py-2.5 text-[12.5px] leading-[1.5] ${status === "error" ? "border-nx-critical/35 bg-nx-critical/10 text-nx-critical-soft" : "border-nx-border bg-nx-raised text-nx-text-2"}`}
                >
                    {status === "error"
                        ? <CircleAlert aria-hidden="true" className="mt-px size-[15px] shrink-0" />
                        : <CircleCheck aria-hidden="true" className="mt-px size-[15px] shrink-0 text-nx-accent" />}
                    <span>{message}</span>
                </div>
            )}
        </div>
    );
}
