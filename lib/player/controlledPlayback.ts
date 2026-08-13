import type { WatchPartyCommand } from "@/lib/core/contracts";

export interface TogglePlaybackPort {
    paused: boolean;
    play: () => Promise<void>;
    pause: () => Promise<void>;
}

export const requestPlaybackToggle = async (
    player: TogglePlaybackPort,
    sendIntent?: (command: WatchPartyCommand) => Promise<unknown>,
    onIntentRejected?: () => void,
): Promise<void> => {
    const shouldPlay = player.paused;

    if (!sendIntent) {
        if (shouldPlay) await player.play();
        else await player.pause();
        return;
    }

    const [, accepted] = await Promise.all([
        shouldPlay ? player.play().catch(() => undefined) : player.pause().catch(() => undefined),
        sendIntent({ kind: shouldPlay ? "play" : "pause" }),
    ]);

    if (accepted === null || accepted === undefined || accepted === false) onIntentRejected?.();
};
