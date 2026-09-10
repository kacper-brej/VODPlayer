# Audyt wydajności odtwarzacza — 7 września 2026

Odtwarzacz można usprawnić bez usuwania obecnych funkcji. Najbardziej konkretne możliwości to skrócenie przygotowania danych odcinka, usunięcie zależności przycisku powrotu od czasu zapisu postępu oraz ograniczenie pracy interfejsu podczas odtwarzania. Szybkość pierwszej klatki nadal zależy od sieci, storage i dekodera; nie ma podstaw do obiecania określonego przyspieszenia całej aplikacji bez pomiaru w przeglądarce.

Przejrzano projekt `D:\VODPlayer`, HEAD `59d4a74`, wraz z zastanymi plikami nieśledzonymi. `D:\nocturnav2` było puste. Nie zmieniono kodu aplikacji. Audyt obejmuje stronę watch, zmianę odcinków, Vidstack/HLS, postęp, Watch Party oraz powiązane odczyty katalogu i sesji.

Zainstalowane wersje: Node 24.19.0, Next 16.3.0, React 19.2.4, Vidstack 1.15.6, hls.js 1.6.16, AWS SDK S3 3.1105.0. Uwzględniono lokalną dokumentację Next zgodnie z `AGENTS.md`.

## Ustalenia i zalecenia

### 1. Przygotowanie jednego odcinka przetwarza cały katalog

**Pewne z kodu; priorytet wysoki przy większej bibliotece.**

`lib/player/resolveWatchData.ts:32` wywołuje `resolveCatalogSeries`. W `lib/catalog/catalog.ts:133` ta funkcja najpierw pobiera cały katalog. `applyViewerAccess` przechodzi przez wszystkie serie i odcinki oraz generuje dla nich podpisane adresy (`catalog.ts:74–100`), zanim zostanie wybrana jedna seria. Potem resolver watch ponownie tworzy źródło wybranego odcinka.

Surowy katalog ma cache Next, ale mapowanie uprawnień i podpisywanie adresów odbywa się poza nim. Trafienie w cache nie usuwa tego kosztu. Ten sam ciąg uruchamia `/api/watch` przy zmianie odcinka.

Zalecenie: osobny odczyt danych wymaganych przez watch. Najpierw można wybierać serię z surowego katalogu przed mapowaniem i podpisywać tylko odtwarzany materiał. Docelowo odczytywać jedną serię i potrzebne informacje o sąsiednich odcinkach. Zachować rozpoznawanie starszych identyfikatorów, wirtualnych tytułów TMDB, uprawnienia, demo, rozdziały oraz wznowienie odtwarzania.

### 2. API wielokrotnie odczytuje sesję, mimo użycia React `cache`

**Pewny wzorzec w kodzie i ograniczenie biblioteki; liczbę zapytań całego żądania należy potwierdzić telemetrycznie.**

`/api/watch` sprawdza użytkownika przez `requireSessionRoute`, ale nie przekazuje `gate.user` do resolvera. Katalog, rozdziały, ustawienia i postęp ponownie wywołują `getSessionUser`. W `/api/hls` użytkownik jest pobierany w `route.ts:16`, a następnie ponownie przez `getViewerGrantSet` w `lib/access/entitlements.ts:13`.

`getSessionUser` jest opakowane w React `cache` (`lib/auth/session.ts`), które służy do deduplikacji podczas renderowania Server Components. Nie zapewnia jej przy zwykłych wywołaniach poza tym kontekstem. Potwierdzono również lokalnie, że dwukrotne wywołanie funkcji opakowanej w `cache` poza renderem wykonuje funkcję dwa razy. [Dokumentacja React](https://react.dev/reference/react/cache).

Zalecenie: przekazywać zweryfikowanego użytkownika, profil i współdzielone obietnice odczytów w kontekście pojedynczego żądania. Zachować kontrolę sesji i dostępu na każdym nowym żądaniu; nie wprowadzać globalnego cache użytkownika, który opóźniałby cofnięcie dostępu. Nie dotyczy to usuwania `cache` z poprawnie działających Server Components.

### 3. Przycisk powrotu czeka na zapis postępu

**Pewne z kodu; bezpośredni wpływ na odczuwaną responsywność.**

`components/video/VideoPlayer.tsx:351` wykonuje `await flushProgress()` przed `onBack`. Kolejka czeka na odpowiedź `/api/progress`, a `lib/progress/saveProgressAction.ts` nie ustawia własnego terminu zakończenia żądania. Przy powolnej bazie lub sieci kliknięcie powrotu pozostaje zależne od tej odpowiedzi.

Zapis już używa `keepalive: true`. Zalecenie: nawigować bez oczekiwania na potwierdzenie serwera, utrzymując niezależną kolejkę postępu. Każdy zapis musi zachować tożsamość profilu, serii i odcinka oraz kolejność. Uwzględnić wyniki `success: false`, których obecny callback w `WatchClient.tsx` nie analizuje; nie traktować nieudanego zapisu jako potwierdzonego. Samo usunięcie `await` bez sprawdzenia cyklu życia kolejki jest niewystarczające.

### 4. Cały panel sterowania subskrybuje czas odtwarzania

**Pewne z kodu; koszt w milisekundach wymaga profilowania React.**

`components/video/PlayerControls.tsx:245` subskrybuje `useMediaState("currentTime")` w dużym komponencie. Wartość jest potrzebna do dodatkowego suwaka Watch Party (`:314`), ale subskrypcja działa także podczas oglądania solo. Ograniczenie `setCurrentTime` do zmian pełnej sekundy w `VideoPlayer.tsx:532` nie ogranicza tej niezależnej subskrypcji.

Zalecenie: przenieść czas i stan przeciągania do małego komponentu suwaka, montowanego tylko dla Watch Party. Oddzielić statyczne kontrolki od fragmentów zależnych od czasu. Następnie sprawdzić liczbę renderów i czas commitów w profilerze, również przy ukrytych kontrolkach. Nie obniżać płynności suwaka przez globalne spowolnienie odświeżania czasu.

### 5. Watch Party blokuje montowanie odtwarzacza siedmioma kolejnymi pomiarami zegara

**Pewne z kodu; wymaga ostrożności przy zachowaniu jakości synchronizacji.**

`lib/party/usePartySync.ts:123` wykonuje siedem kolejnych `await fetch("/api/party/time")`. Dopiero po całej pętli ustawia offset. `WatchClient.tsx:312` do tego czasu zwraca ekran łączenia zamiast odtwarzacza. Przykładowo przy 100 ms na żądanie sama pętla kosztuje około 700 ms — to ilustracja, nie pomiar produkcji. Żądania nie mają własnych timeoutów.

Zalecenie: po potwierdzeniu dołączenia do pokoju równolegle ładować bibliotekę i przygotowywać materiał, utrzymując pauzę oraz blokadę sterowania do ustalenia stanu i zegara. To usuwa zależność ładowania wideo od zakończenia wszystkich próbek, zachowując obecny algorytm synchronizacji. Dodatkowo wprowadzić timeout i anulowanie pomiarów przy wyjściu z pokoju. Wariant wcześniejszego uruchamiania synchronizacji po trzech dobrych próbkach wymaga osobnych pomiarów driftu; nie wdrażać go bez sprawdzenia dokładności.

### 6. Cache playlist nie usuwa kosztu podpisywania segmentów

**Pewne z kodu; koszt CPU potwierdzony lokalnym eksperymentem.**

`lib/player/hlsService.ts:63` przechowuje surową playlistę. Przy każdym żądaniu wariantu `presignLines` (`:86`) ponownie podpisuje wszystkie segmenty i `init.mp4`, seriami po 32. To lokalne operacje kryptograficzne i praca SDK, a nie osobne żądania HTTP do B2 dla każdego podpisu. Gotowa playlista czeka na zakończenie wszystkich podpisów.

Eksperyment używał zainstalowanego AWS SDK, statycznych fikcyjnych kluczy, domeny `example.invalid`, jednego klienta S3 oraz takiej samej wielkości partii. Nie wykonywał odczytów storage ani bazy. Dla każdego rozmiaru wykonano sześć przebiegów; mediana obejmuje ostatnie pięć.

| Segmenty | Podpisy na żądanie | Pierwszy przebieg | Mediana kolejnych pięciu | Rozmiar samych adresów |
| --- | ---: | ---: | ---: | ---: |
| 250 | 251 | 114,67 ms | 71,53 ms | 103 160 B |
| 1200 | 1201 | 305,90 ms | 300,01 ms | 493 610 B |

To pomiar reprezentatywnej pętli SDK na lokalnym komputerze, nie pomiar czasu odpowiedzi `/api/hls` na Vercel. Nazwy obiektów, konfiguracja, sprzęt i obciążenie zmieniają wyniki. Przy segmentach sześci sekund są to odpowiednio 25 minut i dwie godziny materiału.

Obecny `lib/player/__tests__/hlsBenchmark.test.ts` zastępuje bazę, B2 i podpisy funkcjami mock. Sprawdza strukturę pracy i cache surowej playlisty, lecz jego czas nie mierzy realnego podpisywania. Pole `mysqlQueriesPerRequest: 1` opisuje założenie o repozytorium manifestu, nie pełny endpoint z autoryzacją.

Zalecenie: najpierw dodać pomiar rzeczywistego podpisywania. Rozważyć ograniczony cache podpisanych wyników i współdzielenie równoczesnych obliczeń dla tej samej wersji assetu i wariantu. Każde żądanie nadal musi przechodzić kontrolę dostępu oraz aktualnej dostępności assetu. Cache musi uwzględniać rzeczywisty termin ważności podpisów i pozostawiać wystarczający czas na całe odtwarzanie z marginesem; krótsza pozostała ważność po trafieniu w cache nie może pogarszać zachowania. Zmiana sposobu dostarczania segmentów przez CDN to większy, osobny etap.

### 7. Brak jawnego limitu bufora za bieżącą pozycją

**Pewny brak limitu aplikacyjnego; rzeczywiste zużycie pamięci zależy od przeglądarki.**

`lib/player/videoPlayerConfig.ts` ustawia bufor do przodu na 30 sekund z górnym limitem 120 sekund, ale nie ustawia `backBufferLength`. Sam hls.js ma domyślnie `Infinity`; zainstalowany adapter Vidstack przekazuje dla VOD `undefined`. W obu przypadkach sprawdzenie `Number.isFinite(backBufferLength)` w kontrolerze hls.js nie uruchamia przycinania według skończonego limitu czasu. Przeglądarka może samodzielnie usuwać dane pod presją pamięci, więc nie jest to dowód nieograniczonego wycieku.

Zalecenie: zmierzyć pamięć przez 30–60 minut, następnie porównać np. limit 60 i 120 sekund. Cofanie poza zachowany bufor będzie wymagało ponownego pobrania segmentów, więc wpływa to na opóźnienie dalekiego przewijania. Zachować możliwość cofania, odświeżanie wygasłych podpisów oraz stabilność na Safari. To kompromis wymagający pomiarów, nie zmiana gwarantowanie neutralna.

### 8. Ładowanie bibliotek i praca czatu mogą być lepiej rozdzielone

**Pewne zależności importów; wielkość transferu i wpływ na pierwszą klatkę wymagają pomiaru buildu produkcyjnego.**

`WatchClient.tsx:25` ładuje VideoPlayer dynamicznie, a `VideoPlayer.tsx:409` dopiero przy inicjalizacji providera uruchamia import hls.js. Jednocześnie kod czatu i synchronizacji ma importy statyczne w ścieżce oglądania solo, np. `PartyChatPanel` w `VideoPlayer.tsx` i `usePartySync` w `WatchClient.tsx`.

Zalecenie: przygotowywać potrzebne moduły po wyrażeniu zamiaru odtwarzania, np. na focus/pointerenter przycisku odcinka, a moduł pokoju ładować przy wejściu do Watch Party. Zachować obsługę MP4 oraz natywnego HLS. Warto porównać jawną strategię `load="eager"` na stronie watch z aktualnym domyślnym `visible`; nie wprowadzać jej globalnie dla miniaturek katalogu. [Strategie ładowania Vidstack](https://vidstack.io/docs/player/core-concepts/loading/).

Dodatkowo `WatchClient.tsx:192` dopisuje wiadomości do tablicy bez limitu podczas bieżącej sesji, `:223` odbudowuje i sortuje feed, a `PartyChatPanel.tsx:212` grupuje go przy renderze. Panel renderuje wszystkie grupy (`:442`) i jest dzieckiem odtwarzacza aktualizującego własny czas co sekundę. Przy długim czacie koszt rośnie. Rozdzielenie komponentów, stabilne propsy, memoizacja feedu i wirtualizacja widocznych wiadomości pozwolą zachować pełną historię; samo obcięcie tablicy usuwałoby obecną funkcję.

## Co już działa na korzyść wydajności

- Zmiana odcinka korzysta z `/api/watch` i aktualizacji adresu bez ponownego montowania całego odtwarzacza; zachowuje provider.
- Postęp ma kolejkę, zapis okresowy co 12 sekund oraz `keepalive`.
- Część stanu interfejsu odtwarzacza aktualizuje się raz na sekundę zamiast przy każdej zmianie czasu.
- Surowe playlisty mają cache z kluczem zawierającym wersję assetu oraz deduplikację równoczesnych odczytów B2.
- Korekcja Watch Party działa lokalnie, a kanał zdarzeń nie wymaga cyklicznego pobierania pełnego pokoju co sekundę.
- Klient S3 i pula MySQL są współdzielone w procesie.

## Walidacja i proponowana kolejność

Wykonano:

- `npm.cmd test -- lib/player lib/party lib/progress app/api/watch`: **47 plików, 357 testów, wszystkie przeszły**.
- `npm.cmd exec tsc -- --noEmit --incremental false`: **bez błędów**.
- ESLint dla `components/video`, WatchClient, resolvera watch, konfiguracji i serwisu HLS, `usePartySync` i `catalog.ts`: **bez błędów ani ostrzeżeń**.
- Lokalny eksperyment podpisywania AWS SDK i wywołań React `cache` poza renderem.

Nie przeprowadzono pomiaru produkcyjnego w przeglądarce, testów z rzeczywistym B2/MySQL ani pełnego testu oglądania na Safari, urządzeniu mobilnym i dwóch klientach Watch Party. Część testów sprawdza tekst źródłowy lub mocki; zielony wynik nie potwierdza płynności obrazu i rzeczywistego czasu startu.

Najpierw dodać `Server-Timing` dla przygotowania watch, kontroli dostępu, pobrania playlisty i podpisów, a po stronie klienta czas od kliknięcia do pierwszej wyświetlonej klatki. Oddzielnie mierzyć start z zimnym i ciepłym cache, zmianę odcinka, przewijanie, pamięć i liczbę renderów. Nie logować tokenów ani podpisanych adresów. Obecna telemetria pokoju mierzy synchronizację, nie cały start wideo.

Następnie wdrażać małymi krokami:

1. Odseparowanie suwaka od pozostałych kontrolek i nawigacji od oczekiwania na potwierdzenie zapisu.
2. Węższy odczyt watch oraz współdzielenie sesji/profilu w obrębie pojedynczego żądania.
3. Równoległe przygotowanie odtwarzacza w Watch Party, wcześniejsze ładowanie potrzebnych modułów i odseparowanie czatu.
4. Dopiero na podstawie pomiarów zmieniać cache podpisów, wielkość bufora lub długość segmentów. Obecny transcoder generuje segmenty sześci sekund; ich skrócenie zwiększy liczbę podpisów i żądań, więc wymaga łącznego testu całej ścieżki.

Po zmianach sprawdzić odtwarzanie HLS i MP4, start od zera i wznowienie z cofnięciem o pięć sekund, poprzedni/następny odcinek, fullscreen, PiP, głośność, prędkość, intro i autoplay. Dla pokoju: host/gość, przekazanie sterowania, czat, buforowanie i ponowne połączenie. Dla dostępu: demo, cofnięte uprawnienie i wygasły podpis. Porównywać medianę i p95 na tym samym urządzeniu oraz łączu.
