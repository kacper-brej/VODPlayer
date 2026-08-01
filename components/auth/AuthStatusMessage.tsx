import { CircleAlert, CircleCheck } from "lucide-react";

type AuthStatusMessageProps = {
    status: "success" | "error" | null;
    message: string;
};

export function AuthStatusMessage({ status, message }: AuthStatusMessageProps) {
    return (
        <div className="min-h-12" aria-live={status === "error" ? "assertive" : "polite"}>
            {status && message && (
                <div role={status === "error" ? "alert" : "status"} className={`flex gap-3 rounded-xl border bg-nx-raised px-3 py-3 text-[13px] leading-5 ${status === "error" ? "border-nx-critical/45 text-nx-critical" : "border-nx-border text-nx-text-2"}`}>
                    {status === "error" ? <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-nx-accent" />}
                    <span>{message}</span>
                </div>
            )}
        </div>
    );
}
