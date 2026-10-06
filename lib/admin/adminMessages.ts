import type { EpisodeStillsResult } from "./episodeStillsBackfillAction";

export type AdminMessage = { text: string; tone: "error" | "success" | "info" };

export const seasonUpdateMessage = (result: EpisodeStillsResult): AdminMessage => {
    const prefix = "Zapisano numer sezonu. ";
    const retry = "Kliknij „Zapisz sezon i pobierz miniatury”, aby spróbować ponownie.";
    switch (result.status) {
        case "lookup-failed": return { tone: "error", text: `${prefix}Nie udało się pobrać danych odcinków z TMDB. ${retry}` };
        case "save-failed": return { tone: "error", text: `${prefix}Nie udało się zapisać wszystkich danych odcinków. Prawidłowo przetworzono: ${result.matchedEpisodes}. ${retry}` };
        case "no-tmdb-mapping": return { tone: "info", text: `${prefix}Najpierw połącz serial z TMDB, a potem pobierz miniatury ponownie.` };
        case "season-ambiguous": return { tone: "info", text: `${prefix}Nie udało się ustalić sezonu w TMDB. Sprawdź numer sezonu i pobierz miniatury ponownie.` };
        case "no-episodes": return { tone: "info", text: `${prefix}TMDB nie zwróciło odcinków tego sezonu. Sprawdź numer sezonu i spróbuj ponownie.` };
        case "updated":
            if (result.matchedEpisodes === 0) return { tone: "info", text: `${prefix}Nie dopasowano żadnego odcinka. Sprawdź numer sezonu i numerację plików, a potem pobierz miniatury ponownie.` };
            if (result.countMismatch) return { tone: "info", text: `${prefix}Przetworzono odcinki: ${result.matchedEpisodes}. Liczba odcinków w bibliotece różni się od TMDB. Sprawdź sezon i brakujące odcinki.` };
            return { tone: "success", text: `${prefix}Sprawdzono dane i dostępne miniatury dla odcinków: ${result.matchedEpisodes}. Własne miniatury zostały zachowane.` };
    }
};

export const adminErrorMessage = (reason: string): string => {
    if (reason === "unauthorized") return "Sesja wygasła. Zaloguj się ponownie i spróbuj jeszcze raz.";
    if (reason === "forbidden") return "Ta czynność wymaga konta administratora.";
    if (reason === "not_configured") return "Połączenie z TMDB nie jest skonfigurowane. Uzupełnij klucz TMDB na serwerze.";
    if (reason === "network") return "Nie można połączyć się z serwerem. Sprawdź połączenie i spróbuj ponownie.";
    if (reason === "invalid_response") return "Nie udało się odczytać danych. Sprawdź wybrany tytuł i spróbuj ponownie.";
    return "Nie udało się zapisać zmian. Spróbuj ponownie za chwilę.";
};
