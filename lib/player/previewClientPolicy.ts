export interface AutomaticPreviewEnvironment {
    autoPreviewsEnabled: boolean;
    reduceData: boolean;
    saveData: boolean;
    reducedMotion: boolean;
    documentVisible: boolean;
    finePointer: boolean;
    intent: "hover" | "focus";
}

export const shouldAllowAutomaticPreview = (environment: AutomaticPreviewEnvironment): boolean =>
    environment.autoPreviewsEnabled
    && !environment.reduceData
    && !environment.saveData
    && !environment.reducedMotion
    && environment.documentVisible
    && (environment.intent === "focus" || environment.finePointer);
