# Kontrola úplnosti MONITORu

Ověřeno 2026-10-10T12:30:05.929Z proti čerstvému oficiálnímu [katalogu MONITOR](https://monitor.statnipokladna.gov.cz/api/opendata/monitor) a skutečné produkční databázi.

| Data | Katalog / načteno | Nejnovější období |
|---|---:|---|
| Rozpočty FIN | 97 / 97 | 31. 8. 2026 |
| Rozvahy | 57 / 57 | 30. 6. 2026 |
| Obyvatelé MONITOR | 17 roků | 2026 |
| Roční CPI ČSÚ | 16 roků | 2025 |

Původní import načítal jen prosince a nejnovější rozvahu. Oprava doplnila všech 40 chybějících čtvrtletí 2013–2026, zachovala dosavadní ověřená data a zapnula jejich pravidelný import. SOAP 404 přechází na oficiální archiv. Rozvaha 2013/03 je RAR v souboru s příponou ZIP, používá tisíce Kč a DOS EOF marker; parser tyto zdokumentované vlastnosti podporuje.

Ověření: 8688 účetních částek odpovídá původním CSV/SOAP a 57 účetních identit je v pořádku. Roční CSV 2025 bylo nezávisle porovnáno se SOAP: všech 152 řádků souhlasí. Kontrola všech FIN zahrnuje 2 910 přesných součtů faktů a samostatné porovnání 988 agregací / 2 964 částek s původním SOAP. Žádné chybějící publikované období, nesoulad agregací nebo selhávající aktuální validace.

Soukromé RAW úložiště obsahuje 61 archivů / 1137520755 bajtů. U každého byla ověřena délka a metadata SHA-256; první i poslední nově doplněný archiv byl skutečně stažen a přepočítán. Anonymní přístup vrací 403. Dočasná přenosová credential byla po kontrole zrušena. Před importem vznikla nezávislá lokální záloha `artifacts/radar-before-balance-backfill-2026-10-09.dump`.

Webové nasazení `dep-db52u47lot8c73dhli00` je live. Skutečná HTTPS kontrola prošla na všech deseti stránkách, filtrech, CSV a čtyřech analytických nástrojích, včetně přihlášení, odhlášení a odmítnutí anonymního či podvrženého přístupu. Nově doplněná rozvaha 2026/03 se ověřila v prohlížeči.

Neon Function `radarsync`, nasazení 3, úspěšně dokončila denní import 10. 10. 2026 v 03:17 UTC (run 20). Aktuální nasazení 4 navíc podporuje technické aliasy účtů a poškozenou SAP hlavičku exportů roku 2014; opravuje pouze hlavičku a nadále přísně validuje datové řádky. Jednorázový závěrečný import (run 22) doplnil poslední tři rozvahy bez chyb. Požadavek na dočasný minutový test automatická kontrola odmítla; rozvrh nebyl změněn. Denní plán zůstává `17 3 * * *`. V auditní historii jsou zachovány přerušené jednorázové přenosy; následný idempotentní import navázal na poslední ověřený výkaz. Běh 9. 10. nemá doručenou occurrence; další skutečný plánovaný běh 10. 10. je prokázán databází i nativními logy.

CPI je samostatný zdroj ČSÚ. Benchmark dalších měst a GINIS/ORG zůstávají výslovně nepřipojené budoucí adaptéry; tato kontrola pro ně nevytváří data. Žádná placená služba nebyla založena. Lokální podrobné důkazy jsou v ignorovaných `artifacts/cloud-data-audit.json` a `artifacts/cloud-archive-audit.json`.
