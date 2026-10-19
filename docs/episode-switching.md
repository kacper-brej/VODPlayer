# Przygotowanie następnego odcinka

Zwykły odtwarzacz może pobrać dane następnego odcinka jeszcze przed przełączeniem:

- po najechaniu myszą, ustawieniu fokusu lub rozpoczęciu kliknięcia przycisku „Następny odcinek”;
- w ostatnich 75 sekundach odtwarzania, jeśli automatyczne przechodzenie jest włączone. To wyprzedza istniejące odliczanie uruchamiane 60 sekund przed końcem.

Przygotowanie dotyczy odpowiedzi `/api/watch`: źródła odtwarzania, pozycji wznowienia, rozdziałów i ustawień. Nie pobiera fragmentów wideo ani nie tworzy drugiego odtwarzacza. Transfer filmu nadal zaczyna się przy przełączeniu.

W pamięci pojedynczego ekranu przechowywany jest najwyżej jeden kandydat, przez maksymalnie 30 sekund. Link musi mieć jeszcze ponad 15 sekund ważności. Kliknięcie wykorzystuje gotową odpowiedź lub dołącza do trwającego żądania; brak aktualnego wyniku uruchamia dotychczasowe pobieranie. Błąd przygotowania pozostaje niewidoczny dla oglądającego, a kolejne próby mają ograniczoną częstotliwość.

Samo przygotowanie ma limit 8 sekund. Gdy kliknięcie przejmuje trwające żądanie, ten limit zostaje wyłączony — obowiązuje wtedy limit przełączenia, czyli 15 sekund od kliknięcia. Wolna odpowiedź nie jest przez to przerywana i pobierana od nowa tylko dlatego, że żądanie zaczęło się przed kliknięciem.

Przygotowanie jest wyłączone w Watch Party, dla demo, ustawienia profilu „oszczędzanie danych”, przeglądarkowego Save-Data, połączenia 2G, trybu offline i ukrytej karty. Kandydat jest usuwany po zmianie materiału, opuszczeniu strony, ukryciu karty, utracie fokusu okna oraz zmianie danych wejściowych ekranu. Nie jest zapisywany w localStorage, service workerze ani wspólnym cache HTTP. Przygotowana pozycja wznowienia jest krótkotrwałym odczytem z momentu przygotowania, nie subskrypcją zmian na innych urządzeniach.

## Odczyty po stronie serwera

`/api/watch` tworzy izolowany zakres odczytów dla każdego żądania. Sprawdzenie sesji na wejściu jest współdzielone z odczytem uprawnień, ustawień, rozdziałów i postępu; ustawienia i postęp współdzielą ustalenie własności aktywnego profilu. Równoległe żądania nie dzielą wyników. Kolejne żądanie sprawdza sesję i dostęp ponownie. Odczyty postępu, ustawień i uprawnień nie trafiają do trwałego cache.

Poza tym endpointem pozostaje dotychczasowe działanie, w tym React cache podczas renderowania serwerowego. Operacje zapisu nadal sprawdzają własność profilu niezależnie. Przygotowanie przechodzi zwykłą autoryzację `/api/watch`; kontrola dostępu do manifestów HLS i ważność podpisanych adresów nie zostały zmienione.

## Weryfikacja

Testy sprawdzają współdzielenie żądania rozpoczętego przed kliknięciem, jednorazowe użycie danych, wygaśnięcie, błędy, anulowanie, oszczędzanie transferu oraz izolację użytkowników i profili. Dla pięciu odczytów sesji w jednym żądaniu test potwierdza jedno sprawdzenie w repozytorium zamiast pięciu; ustawienia i postęp wykonują jedno ustalenie profilu zamiast dwóch.

To redukcja pracy w testach, nie pomiar przyspieszenia produkcji. Rzeczywisty efekt należy porównać na tym samym urządzeniu i łączu: kliknięcie do pierwszej klatki, osobno z gotowym przygotowaniem i bez niego, także po zmianie profilu, wygaśnięciu sesji, przewinięciu filmu i przy wolnym połączeniu.

## Podpisane playlisty HLS

Po sprawdzeniu sesji, podpisu URL, uprawnień i aktualnej dostępności assetu serwer może ponownie wykorzystać podpisaną playlistę wariantu VOD. Cache obejmuje wyłącznie gotowe playlisty z `#EXT-X-ENDLIST`, nie główną playlistę z krótkotrwałymi adresami wariantów. Klucz obejmuje tożsamość i wersję assetu, wysokość obrazu, ścieżkę playlisty oraz czas ważności podpisów segmentów.

Gotowa treść jest przechowywana najwyżej 60 sekund od rozpoczęcia podpisywania, nigdy do ostatnich 120 sekund ważności adresów. Trafienie w cache nie przedłuża tego czasu. Obowiązuje limit 128 wpisów i 32 MiB szacowanego miejsca na klucze oraz treść UTF-16; najdawniej używane wpisy są usuwane. Zbyt duża playlista nadal jest zwracana, ale nie trafia do cache. Odpowiedzi HTTP pozostają `no-store`. Cache działa w pamięci pojedynczego procesu i znika po restarcie.

Równoczesne żądania tego samego wariantu nadal współdzielą podpisywanie. Błędy nie trafiają do cache. Wyczyszczenie cache unieważnia też zapis wyników wcześniej rozpoczętych operacji. Szablony pobrane z B2 zachowują osobny, dotychczasowy czas przechowywania; ich klucz uwzględnia teraz również ścieżkę playlisty.

Kontrolowany test 250 segmentów i pliku inicjalizacyjnego potwierdza 251 podpisów przy pierwszym żądaniu i zero przy trafieniu w cache. Sprawdzenie dostępności assetu nadal odbywa się przy każdym żądaniu. Test korzysta z atrap magazynu i podpisywania — jego czasy nie opisują produkcji.

## Pomiary przełączania

Panel `/admin/performance` pokazuje osobno czas oczekiwania na dane odcinka i całkowity czas do pierwszej klatki, z podziałem na zwykłe pobranie oraz wcześniejsze przygotowanie. Są to odrębne próbki od startu filmu. Szczegóły i ograniczenia: [Pomiary szybkości strony i odtwarzacza](performance-measurements.md).
