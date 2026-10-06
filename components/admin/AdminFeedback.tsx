import { CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import s from "./admin.module.css";

export default function AdminFeedback({ children, tone = "info" }: {
    children: React.ReactNode;
    tone?: "info" | "success" | "error" | "busy";
}) {
    const Icon = tone === "error" ? TriangleAlert : tone === "success" ? CheckCircle2 : tone === "busy" ? LoaderCircle : Info;
    return <div className={s.notice} data-tone={tone} role={tone === "error" ? "alert" : "status"}>
        <Icon size={18} aria-hidden="true" className={tone === "busy" ? "animate-spin motion-reduce:animate-none" : undefined} />
        <div>{children}</div>
    </div>;
}
