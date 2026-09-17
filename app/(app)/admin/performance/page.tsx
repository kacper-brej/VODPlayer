import { notFound } from "next/navigation";
import PerformanceOverview from "@/components/admin/PerformanceOverview";
import { getCurrentUserAction } from "@/lib/auth/authActions";
import { getPerformanceStore } from "@/lib/performance/store";
import { getDbMetricsSnapshot } from "@/lib/db/metrics";

export default async function PerformancePage() {
    const user = await getCurrentUserAction();
    if (!user || user.role !== "admin") notFound();
    return <PerformanceOverview snapshot={getPerformanceStore().snapshot()} database={getDbMetricsSnapshot()} />;
}
