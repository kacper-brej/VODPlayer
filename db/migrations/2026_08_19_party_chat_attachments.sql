-- Etap W12: załączniki obrazkowe w czacie pokoju.
-- Kolejność wdrożenia: najpierw ta migracja, następnie kod aplikacji.
-- Kompensacja: kod można cofnąć do poprzedniej wersji — nowe kolumny są wtedy
-- nieużywane, a istniejące wiadomości tekstowe zachowują się bez zmian.

-- Trzymamy wyłącznie ADRES obrazka, nie sam plik: pokoje żyją 6 godzin,
-- a budżet B2 (10 GB) jest przeznaczony na materiał wideo, nie na czat.
-- attachment_kind rozróżnia obrazek statyczny od GIF-a, żeby interfejs mógł
-- wstrzymać animację bez zgadywania po rozszerzeniu.

ALTER TABLE `watch_party_messages`
  MODIFY COLUMN `body` VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN `attachment_url` VARCHAR(1024) DEFAULT NULL AFTER `body`,
  ADD COLUMN `attachment_kind` ENUM('image','gif') DEFAULT NULL AFTER `attachment_url`;

-- Rollback:
-- ALTER TABLE watch_party_messages
--   DROP COLUMN attachment_kind,
--   DROP COLUMN attachment_url,
--   MODIFY COLUMN body VARCHAR(500) NOT NULL;
