"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import { METRIC_NAMES } from "@/lib/performance/contracts";
import { capturePerformanceContext, captureWatchIntent, flushPerformanceSamples, performanceSamplingEnabled, reportPerformanceSample } from "@/lib/performance/client";

const reportVitals: Parameters<typeof useReportWebVitals>[0] = ({ id, name, value }) => {
    if (!METRIC_NAMES.includes(name as typeof METRIC_NAMES[number])) return;
    reportPerformanceSample({ id, name: name as typeof METRIC_NAMES[number], value });
};

export default function PerformanceMonitor() {
    useReportWebVitals(reportVitals);
    useEffect(() => {
        if (!performanceSamplingEnabled()) return;
        capturePerformanceContext();
        const onHidden = () => {
            if (document.visibilityState === "hidden") queueMicrotask(flushPerformanceSamples);
        };
        window.addEventListener("pagehide", flushPerformanceSamples);
        document.addEventListener("visibilitychange", onHidden);
        document.addEventListener("click", captureWatchIntent, true);
        return () => {
            flushPerformanceSamples();
            window.removeEventListener("pagehide", flushPerformanceSamples);
            document.removeEventListener("visibilitychange", onHidden);
            document.removeEventListener("click", captureWatchIntent, true);
        };
    }, []);
    return null;
}
