import type { ProfileSettings } from "@/lib/core/contracts";

export const mergeSettingsAfterSave = (
    current: ProfileSettings,
    submitted: ProfileSettings,
    saved: ProfileSettings,
): ProfileSettings => {
    const merged = { ...saved };
    for (const key of Object.keys(saved) as Array<keyof ProfileSettings>) {
        if (!Object.is(current[key], submitted[key])) {
            Object.assign(merged, { [key]: current[key] });
        }
    }
    return merged;
};
