import WatchClient from "./WatchClient";
import { resolveWatchData } from "@/lib/player/resolveWatchData";
import { notFound } from "next/navigation";
import { DataErrorState } from "@/components/data/DataState";

const ErrorScreen = ({ message }: { message: string }) => (
    <div className="fixed inset-0 z-[999] bg-black min-h-dvh flex items-center justify-center text-foreground">
        {message}
    </div>
);

const DataErrorScreen = ({ reason }: { reason: Parameters<typeof DataErrorState>[0]["reason"] }) => (
    <div className="fixed inset-0 z-[999] flex min-h-dvh items-center justify-center bg-black p-4">
        <DataErrorState reason={reason} headingLevel={1} />
    </div>
);

const WatchPage = async ({ searchParams }: { searchParams: Promise<{ id?: string; ep?: string; party?: string }> }) => {
    const { id, ep, party } = await searchParams;
    const result = await resolveWatchData(id, ep, party);
    if (result.kind === "not-found") notFound();
    if (result.kind === "data-error") return <DataErrorScreen reason={result.reason} />;
    if (result.kind === "error") return <ErrorScreen message={result.message} />;
    return <WatchClient {...result.data} />;
};

export default WatchPage;
