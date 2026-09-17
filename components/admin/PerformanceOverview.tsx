import type { getPerformanceStore } from "@/lib/performance/store";
import type { DbMetricSnapshot } from "@/lib/db/metrics";

const names: Record<string, string> = {
    LCP: "Główna treść", INP: "Reakcja na kliknięcie", CLS: "Przesunięcia układu", FCP: "Pierwsza treść", TTFB: "Odpowiedź serwera",
    PLAYER_STARTUP: "Start filmu", PLAYER_SEEK: "Przewijanie filmu", PLAYER_BUFFER: "Przerwa na buforowanie", PLAYER_ERROR: "Błąd odtwarzania",
};
const pages: Record<string, string> = { home: "Główna", catalog: "Katalog", series: "Serial", watch: "Odtwarzacz", library: "Biblioteka", settings: "Ustawienia", other: "Pozostałe" };
const format = (value: number, name: string) => name === "CLS" ? value.toFixed(3) : `${Math.round(value).toLocaleString("pl-PL")} ms`;

export default function PerformanceOverview({ snapshot, database }: { snapshot: ReturnType<ReturnType<typeof getPerformanceStore>["snapshot"]>; database: DbMetricSnapshot[] }) {
    return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="font-display text-3xl text-nx-text">Wydajność</h1>
        <p className="mt-3 text-sm leading-6 text-nx-text-2">Wyniki z próbki wizyt. P75 oznacza, że 75% zebranych wyników było nie większych od tej wartości.</p>
        <p className="mt-2 text-sm leading-6 text-nx-text-2">Ostatnie 24 godziny, do 512 najnowszych pomiarów w każdej grupie. Widok obejmuje tę instancję serwera i zeruje się po jej restarcie. Buforowanie pokazuje ukończone przerwy podczas oglądania.</p>
        {snapshot.rows.length === 0 ? <p className="mt-8 rounded-xl border border-nx-border p-5 text-nx-text-2">Brak pomiarów. Wyniki pojawią się po wizytach i odtworzeniach objętych próbkowaniem.</p> :
            <div className="mt-6 overflow-x-auto rounded-xl border border-nx-border">
                <table className="w-full min-w-[680px] text-left text-sm text-nx-text">
                    <caption className="sr-only">Szybkość strony i odtwarzacza</caption>
                    <thead className="bg-nx-panel"><tr>{["Pomiar", "Strona", "Urządzenie", "Źródło", "Próbki", "P50", "P75", "P95"].map((label) => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
                    <tbody>{snapshot.rows.map((row) => <tr key={`${row.name}:${row.page}:${row.device}:${row.delivery}`} className="border-t border-nx-border">
                        <th scope="row" className="px-3 py-3 font-medium">{names[row.name]}</th>
                        <td className="px-3 py-3">{pages[row.page]}</td><td className="px-3 py-3">{row.device === "mobile" ? "Telefon" : "Duży ekran"}</td>
                        <td className="px-3 py-3">{row.delivery === "page" ? "Strona" : row.delivery.toUpperCase()}</td><td className="px-3 py-3">{row.count}</td>
                        {[row.p50, row.p75, row.p95].map((value, index) => <td key={index} className="whitespace-nowrap px-3 py-3">{row.name === "PLAYER_ERROR" ? "—" : format(value, row.name)}</td>)}
                    </tr>)}</tbody>
                </table>
            </div>}
        <h2 className="mt-10 font-display text-2xl text-nx-text">Zapytania bazy danych</h2>
        <p className="mt-2 text-sm text-nx-text-2">Pomiary operacji katalogu i transakcji od uruchomienia tej instancji serwera.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm text-nx-text">
            <thead><tr>{["Operacja", "Wywołania", "Błędy", "Średnio", "Najdłużej"].map((label) => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
            <tbody>{database.map((row) => <tr key={row.operation} className="border-t border-nx-border"><th scope="row" className="px-3 py-3 font-medium">{row.operation}</th><td className="px-3 py-3">{row.count}</td><td className="px-3 py-3">{row.failures}</td><td className="px-3 py-3">{Math.round(row.averageMs)} ms</td><td className="px-3 py-3">{Math.round(row.maxMs)} ms</td></tr>)}</tbody>
        </table></div>
    </div>;
}
