import { Suspense } from "react";
import { QrConfirmCard } from "@/components/auth/QrConfirmCard";

export default function QrConfirmPage() {
    return (
        <Suspense>
            <QrConfirmCard />
        </Suspense>
    );
}
