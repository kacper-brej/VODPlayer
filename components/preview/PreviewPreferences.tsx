"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface PreviewPreferencesValue {
    autoPreviewsEnabled: boolean;
    reduceData: boolean;
    setPreviewPreferences: (value: { autoPreviewsEnabled: boolean; reduceData: boolean }) => void;
}

const PreviewPreferencesContext = createContext<PreviewPreferencesValue | null>(null);

export const PreviewPreferencesProvider = ({
    autoPreviewsEnabled,
    reduceData,
    children,
}: {
    autoPreviewsEnabled: boolean;
    reduceData: boolean;
    children: ReactNode;
}) => {
    const [preferences, setPreviewPreferences] = useState({ autoPreviewsEnabled, reduceData });
    const value = useMemo(() => ({ ...preferences, setPreviewPreferences }), [preferences]);

    return <PreviewPreferencesContext.Provider value={value}>{children}</PreviewPreferencesContext.Provider>;
};

export const usePreviewPreferences = (): PreviewPreferencesValue => {
    const value = useContext(PreviewPreferencesContext);
    if (!value) throw new Error("usePreviewPreferences wymaga PreviewPreferencesProvider");
    return value;
};
