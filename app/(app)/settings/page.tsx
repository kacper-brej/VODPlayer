import SettingsPanel from "@/components/settings/SettingsPanel";
import { DEFAULT_PROFILE_SETTINGS, getSettings } from "@/lib/settings";

const SettingsPage = async () => {
    const result = await getSettings();
    const settings = result.kind === "success" ? result.data : DEFAULT_PROFILE_SETTINGS;

    return (
        <SettingsPanel
            initialSettings={settings}
            loadFailed={result.kind === "error"}
        />
    );
};

export default SettingsPage;
