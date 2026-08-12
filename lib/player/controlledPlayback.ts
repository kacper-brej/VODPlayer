import type { WatchPartyCommand } from "@/lib/core/contracts";

export interface TogglePlaybackPort {
    paused: boolean;
    play: () => Promise<void>;
    pause: () => Promise<void>;
}

export const requestPlaybackToggle = async (
    player: TogglePlaybackPort,
    sendIntent?: (command: WatchPartyCommand) => Promise<unknown>,
): Promise<void> => {
    if (sendIntent) {
        await sendIntent({ kind: player.paused ? "play" : "pause" });
        return;
    }
    if (player.paused) await player.play();
    else await player.pause();
};
