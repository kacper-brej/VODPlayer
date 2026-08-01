import ProfileSelector from "@/components/profiles/ProfileSelector";
import { getProfiles } from "@/lib/profiles";
import { DataErrorState } from "@/components/data/DataState";

export default async function ProfilesPage() {
    const result = await getProfiles();

    if (result.kind === "error") {
        return (
            <div className="min-h-dvh w-full bg-background flex items-center justify-center p-4">
            <DataErrorState reason={result.reason} headingLevel={1} />
            </div>
        );
    }

    if (result.kind === "empty" || result.data.length === 0) {
        return (
            <div className="grid min-h-dvh place-items-center bg-nx-bg p-4 text-nx-text">
                <p role="status" className="text-sm text-nx-text-2">Przygotowujemy profil domyślny…</p>
            </div>
        );
    }

    return <ProfileSelector profiles={result.data} />;
}
