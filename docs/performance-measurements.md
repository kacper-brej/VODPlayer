# Pomiary szybkości strony i odtwarzacza

Panel administratora: `/admin/performance`. Chroniony odczyt JSON: `GET /api/performance`.

Domyślnie pomiary są wysyłane z około 10% dokumentów otwartych przez użytkowników. `NEXT_PUBLIC_PERFORMANCE_SAMPLE_RATE=1` obejmuje wszystkie wizyty, `0` wyłącza wysyłanie. Zmiana tej zmiennej wymaga ponownego builda. Raport zawiera kategorię strony, klasę szerokości ekranu, typ źródła i wynik; nie zawiera adresu filmu, tytułu, klucza serialu ani identyfikatora konta. Losowe ID służy wyłącznie aktualizacji pomiaru.

Paczki są wysyłane co 15 sekund, po opuszczeniu odtwarzacza lub ukryciu strony. Limit to 20 pomiarów na paczkę i 12 paczek na minutę na konto w danej instancji. Błąd pomiaru nie powoduje ponawiania odtwarzania ani komunikatu w interfejsie.

## Interpretacja

- LCP, INP, CLS, FCP i TTFB dotyczą całego dokumentu, przypisanego do strony jego początkowej nawigacji. Nie są czasami każdej późniejszej nawigacji SPA. Niektóre wyniki powstają dopiero po interakcji lub ukryciu karty.
- `PLAYER_STARTUP`: czas od przejścia do odtwarzacza albo próby rozpoczęcia odtwarzania do pierwszej klatki po zdarzeniu `playing`. Bez `requestVideoFrameCallback` końcem jest `playing`. Bez zachowanego kliknięcia początek przypada na zamontowanie odtwarzacza. Oczekiwanie na zgodę na autoplay jest pomijane po zgłoszeniu odmowy przez odtwarzacz.
- `PLAYER_SEEK`: czas od `seeking` do `seeked` po rozpoczęciu filmu.
- `PLAYER_BUFFER`: ukończona przerwa pomiędzy `waiting` a powrotem obrazu. Pauza, przewijanie i ukryta karta przerywają pomiar. Liczba próbek oznacza liczbę ukończonych przerw, nie udział czasu buforowania w całym filmie.
- `PLAYER_ERROR`: zdarzenia błędu zwykłego odtwarzacza; kolejne powtórzenia są scalane do wznowienia obrazu. To licznik zdarzeń, nie odsetek nieudanych sesji.
- Wspólne oglądanie korzysta z dotychczasowej, osobnej telemetrii.

Panel przechowuje do 512 najnowszych próbek na grupę z ostatnich 24 godzin w pamięci procesu. Restart usuwa dane, a wiele instancji ma osobne wyniki. To nie jest trwały raport całego wdrożenia. `PERFORMANCE_LOGS=1` zapisuje przyjęte próbki jako wiersze JSON z `event=performance` w logach serwera. Przy agregowaniu logów należy aktualizować próbki według `name`, `id`, kategorii strony, urządzenia i źródła. Do historii całego wdrożenia potrzebny jest działający zbieracz logów i ustalona retencja.

P75 to wynik, którego nie przekraczało 75% zapisanych próbek. Porównuj osobno telefon i duży ekran oraz HLS i plik. Przy małej liczbie próbek nie wyciągaj wniosków o wszystkich użytkownikach.

## Test obciążenia HTTP

Uruchom build i serwer produkcyjny lokalnie. Serwer developerski nie nadaje się do porównywania szybkości.

```powershell
npm run build
npm run start -- --hostname 127.0.0.1 --port 3017
```

W drugim terminalu:

```powershell
npm run test:load -- --url http://127.0.0.1:3017 --paths /login,/api/party/time --concurrency 5 --requests 60
```

Te publiczne ścieżki sprawdzają jedynie HTTP i renderowanie logowania. Nie obciążają katalogu, sesji oglądania ani serwera plików. Dla zalogowanych ścieżek ustaw lokalnie `LOAD_TEST_COOKIE` na wartość nagłówka Cookie konta testowego, a następnie wybierz `/`, `/explore` lub konkretną ścieżkę odtwarzania. Skrypt nie wypisuje ciasteczka ani parametrów zapytania. Nie zapisuj ciasteczka w repozytorium.

Skrypt wykonuje GET, nie śledzi przekierowań, a odpowiedzi logowania i timeouty zalicza do błędów. Pokazuje percentyle tylko udanych odpowiedzi, liczbę błędów i rozmiar transferu. Nie uruchamia JavaScript ani dekodowania wideo, więc nie zastępuje równoczesnych sesji w przeglądarkach. Większe obciążenie uruchamiaj na własnym środowisku testowym. Najpierw porównaj 1, 5 i 10 równoczesnych żądań, zachowując te same ścieżki i stan cache.

## Sprawdzenie telefonów

Na fizycznym iPhonie w Safari i Androidzie w Chrome sprawdź ten sam materiał oraz:

1. Pierwszy start, wznowienie postępu i przejście do następnego odcinka.
2. Pauzę, przewijanie, intro, napisy i zmianę jakości.
3. Fullscreen, obrót ekranu i nawigację po długiej liście.
4. Blokadę ekranu, powrót po minucie i przełączenie do innej aplikacji.
5. Słabsze połączenie, chwilową utratę sieci i odzyskanie odtwarzania.
6. Wspólne oglądanie i wymagane potwierdzenie odtwarzania gestem.

Zapisz model urządzenia, wersję systemu, przeglądarkę, sieć i kroki błędu. Emulacja rozmiaru przeglądarki nie jest potwierdzeniem poprawności na tych urządzeniach.

## Kontrola lokalna 2026-09-17

Build produkcyjny Next 16.3.0 uruchomiony na `127.0.0.1:3017`. Najpierw 10 żądań rozgrzewających, następnie trzy serie po 60 żądań, po 30 na każdą ścieżkę. Wszystkie 180 żądań pomiarowych zakończyło się statusem 200.

| Równoległe żądania | Logowanie P50 / P95 | Endpoint czasu P50 / P95 | Błędy |
| --- | --- | --- | --- |
| 1 | 15 / 17 ms | 15 / 16 ms | 0/60 |
| 5 | 14 / 29 ms | 6 / 17 ms | 0/60 |
| 10 | 22 / 40 ms | 10 / 30 ms | 0/60 |

To krótka kontrola działania narzędzia i publicznych endpointów, bez ruchu produkcyjnego, uwierzytelnionego katalogu, zapytań bazy ani transferu wideo. Nie określa liczby widzów, którą utrzyma wdrożenie.

Pełny zestaw 1383 testów, lint i build przeszedł. Panel wyników sprawdzono w przeglądarce przy szerokości 390 i 1280 px na przykładowych danych: bez poziomego rozciągania strony, z działającym przewijaniem tabeli. Nie wykonano testów na fizycznym iPhonie ani Androidzie.
