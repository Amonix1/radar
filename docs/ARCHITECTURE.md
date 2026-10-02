# Technický návrh — Finanční radar Litvínova

Next.js App Router poskytuje veřejné analytické rozhraní a read-only JSON/CSV API. PostgreSQL ukládá RAW odpovědi, normalizovaná fakta a agregace. Samostatný TypeScript ETL proces používá výhradně oficiální JSON-LD katalog, SOAP ExtractData a XML číselníky MONITORu. Žádný scraping HTML.

## Ověřený zdroj

- Katalog: https://monitor.statnipokladna.gov.cz/api/opendata/monitor
- WSDL: https://monitor.statnipokladna.gov.cz/api/monitorws?wsdl
- XSD: https://monitor.statnipokladna.gov.cz/data/xsd/ws/monitorTypes.xsd
- Metodika: https://monitor.statnipokladna.gov.cz/metodika/
- SOAP: ExtractData, OrganizaceIC=00266027, Rad=1, poslední den měsíce.
- FIN do roku 2025: 051, Fin212M (části I, II, III, IV, VI).
- FIN od roku 2026: 063, Fin212M2026, unifikovaná věta CastI + účty CastII.
- Rozvaha: 001, samostatné čtvrtletní období; její datum je vždy uvedeno u dluhu.
- Ukazatele: 100; dostupnost odvozena z odpovědi služby, nenahrazuje chybějící výkaz.

Katalog k ověření obsahuje FIN od 2010, čtvrtletní období od 2013 a měsíční od 2020. Dostupnost SOAP se kontroluje při importu; při 404 je použita oficiální CSV ZIP distribuce z katalogu. Leden/červenec se nevymýšlí. Skutečnost je kumulativní od počátku roku; období se nikdy nesčítají. K 1. 10. 2026 je aktivních 97 rozpočtových období, nejnovější srpen 2026. Rozvahy jsou načtené za uzavřené roky a nejnovější dostupné čtvrtletí; nejde o kompletní historii všech čtvrtletních rozvah.

## Vrstvy

RAW: append-only snapshot s SHA-256, zdrojovým URL, IČO, výkazem, datem importu, tělem odpovědi. Změna zdroje vytváří nový snapshot. NORMALIZED: řádky s původními řetězci částek a přesnými integer haléři; zachovává dimenze ÚZ, partner, prostorová jednotka a nástroj. Aktuální verze je samostatný ukazatel `active_statement`, historie zůstává. ANALYTICS: agregace per snapshot, nikoli přepisy historie. Databázový pohled zpřístupňuje jen ověřené veřejné aktivní snapshoty.

Konsolidace jedné účetní jednotky používá časově platné `kon_pol` oficiálního číselníku. Nekonsolidují se automaticky všechny transfery mezi různými městy. Staré FIN kontrolují částky proti rekapitulačním řádkům 4050/4240, 4200/4430/4440. Nový FIN kontroluje účetní identitu příjmy − výdaje + financování = 0. Neúspěšný snapshot nemůže nahradit poslední ověřená data.

## Bezpečnost a provoz

Veřejné dotazy čtou explicitní public pohled. Interní GINIS bude mít vlastní adaptér a visibility=internal; RAW není dostupné přes web. Synchronizace má PostgreSQL advisory lock, transakce, retry s timeoutem a samostatný audit úspěchu/chyby. Admin synchronizaci chrání náhodný SYNC_TOKEN; web jej neobsahuje. Automatizace je samostatný worker `npm run sync:watch`, vhodný pro systemd/container. PostgreSQL je dostupný jen na localhost; produkce vyžaduje privátní DB síť, HTTPS a správu secrets. Hosting Sites s D1 neodpovídá požadovanému PostgreSQL/Node stacku; tento projekt je určen pro Node/Docker hosting.

## Analytika a budoucí zdroje

KPI, drill-down a sezónnost jsou deterministické funkce. Srovnání používá stejný měsíc minulých let; starší prosinec není náhradou srpna. Trendy používají buď uzavřené roky nebo stejné meziroční období. Reálné Kč vyžadují časově identifikované CPI; nepublikují se bez něj. Rozvaha, populace a CPI používají vlastní snapshoty; chybějící data jsou NULL. Populace je z oficiálního výkazu ukazatelů MONITORu. CPI 2010–2025 vychází z ověřeného ročního přehledu ČSÚ, původní PDF i přepsané hodnoty jsou v RAW. Nové roční CPI vyžaduje aktualizaci ověřeného zdroje. Benchmark je budoucí adaptér; další města nejsou načtená.

Položkové signály srovnávají dva po sobě jdoucí uzavřené roky, základ i absolutní změna nejméně 1 mil. Kč. Růst nad výdaji: rozdíl nejméně 10 p. b.; růst nad inflací: rozdíl nejméně 5 p. b.; skok: absolutní změna nejméně 50 %. Rozhodují nad agregovaným paragrafem/položkou, nezjišťují příčiny. Sezónní signál: odchylka nejméně 5 p. b. za min–max posledních pěti stejných měsíců, minimum tří pozorování. Jednotlivé signály uvádějí období, hodnoty a výpočet.

Analytik má čtyři registrované analytické nástroje a uvádí původ hodnot, matematický výpočet a interpretaci; volný SQL přístup nemá. Aktuální směrování dotazů je deterministické. TODO modelový adaptér může vybírat jen povolené nástroje, musí předat explicitní IČO/období, nesmí použít interní snapshoty ve veřejném režimu a musí vracet strukturované zdroje; číselné výsledky zůstávají výstupem SQL/funkcí. Provozní peníze ani jazykový model zde nejsou simulované.
