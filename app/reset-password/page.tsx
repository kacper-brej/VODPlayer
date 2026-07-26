import { Suspense } from "react";
import { ResetPasswordCard } from "@/components/auth/ResetPasswordCard";

export default function ResetPasswordPage() {
    return (
        <Suspense>
            <ResetPasswordCard />
        </Suspense>
    );
}
