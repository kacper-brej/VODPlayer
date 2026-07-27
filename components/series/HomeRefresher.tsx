"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const HomeRefresher = () => {
    const router = useRouter();

    useEffect(() => {
        router.refresh();
    }, [router]);

    return null;
};

export default HomeRefresher;
