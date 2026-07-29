export const COMMAND_PALETTE_OPEN_EVENT = "nocturna:open-command-palette";

export const openCommandPalette = () => {
    window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
};
