import { Suspense } from "react";
import { SignInCard } from "@/components/auth/SignInCard";

export default function LoginPage() {
    return (
        <Suspense>
            <SignInCard />
        </Suspense>
    );
}
