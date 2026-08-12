export interface StartPartyResult {
    ok: boolean;
    code?: string;
    error?: string;
}

const GENERIC_ERROR = "Nie udało się utworzyć pokoju. Spróbuj ponownie.";

export const startPartyForEpisode = async (
    seriesKey: string,
    episodeKey: string,
): Promise<StartPartyResult> => {
    try {
        const response = await fetch("/api/party", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ series_key: seriesKey, episode_key: episodeKey }),
        });

        if (!response.ok) {
            return {
                ok: false,
                error: response.status === 403
                    ? "Ten tytuł nie jest dostępny do wspólnego oglądania."
                    : GENERIC_ERROR,
            };
        }

        const payload = await response.json().catch(() => null) as { code?: unknown } | null;
        const code = typeof payload?.code === "string" ? payload.code : null;
        return code ? { ok: true, code } : { ok: false, error: GENERIC_ERROR };
    } catch {
        return { ok: false, error: "Nie udało się połączyć z serwerem." };
    }
};
