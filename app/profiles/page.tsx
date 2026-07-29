import ProfileSelector from "@/components/profiles/ProfileSelector";
import { getProfiles } from "@/lib/profiles";
import { DataErrorState, DataState } from "@/components/data/DataState";

export default async function ProfilesPage() {
    const result = await getProfiles();

    if (result.kind === "error") {
        return (
            <div className="min-h-dvh w-full bg-background flex items-center justify-center p-4">
                <DataErrorState reason={result.reason} />
            </div>
        );
    }

    if (result.kind === "empty" || result.data.length === 0) {
        return (
            <div className="min-h-dvh w-full bg-background flex items-center justify-center p-4">
                <DataState
                    kind="empty"
                    title="Brak profili"
                    description="Nie znaleziono żadnego profilu na tym koncie."
                />
            </div>
        );
    }

    return <ProfileSelector profiles={result.data} />;
}
