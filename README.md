# Finanční radar Litvínova

Funkční analytická aplikace pro **Město Litvínov, IČO 00266027**. Next.js / TypeScript / Tailwind / komponenty shadcn/ui na Radix / Recharts / PostgreSQL / TypeScript ETL. Veřejné rozhraní používá skutečná ověřená data; neobsahuje demonstrační rozpočet.

## Cloudová aplikace

Web je nasazený na [financni-radar-litvinova.onrender.com](https://financni-radar-litvinova.onrender.com). Vyžaduje přístupové heslo; samotné heslo není ve zdrojích. Provoz používá Render Free a Neon Free. Po nečinnosti může první otevření webu trvat přibližně minutu.

Vlastník spravuje [web v Renderu](https://dashboard.render.com/web/srv-db00ki3ncjis738153q0) a [databázi, RAW úložiště a denní aktualizátor v Neonu](https://console.neon.tech/app/projects/summer-pond-52900241) svými osobními účty. Přístupové heslo aplikace se pro správu těchto účtů nepoužívá. Podrobnosti jsou v [docs/CLOUD.md](docs/CLOUD.md).

## Spuštění

Požadavky: Node.js 22+, npm, Docker s Compose; síťový přístup k oficiálním službám MONITORu a ČSÚ. První historický import stahuje také objemnější oficiální CSV archivy.

```powershell
npm ci
Copy-Item .env.example .env
# V .env změňte POSTGRES_PASSWORD i odpovídající heslo v DATABASE_URL.
# SYNC_TOKEN nastavte na náhodný dlouhý token. Nepoužívejte ukázkové hodnoty.
docker compose -p financni-radar-litvinova up -d db
npm run db:migrate
npm run access:configure
npm run sync
npm run data:cpi
npm run dev -- --port 3100
```

Otevřete http://127.0.0.1:3100. Databáze používá vlastní Docker volume a port **55432**, aby nekolidovala s běžnou lokální PostgreSQL. `.env` a stažené archivy nejsou součástí Gitu. V této pracovní instalaci jsou již databáze, historie i CPI načtené.

## Produkční provoz a automatická aktualizace

```powershell
npm run build
npm run start -- --port 3100
# V samostatném procesu:
npm run sync:watch
```

Worker po spuštění a každých `SYNC_INTERVAL_HOURS` (výchozí 24 hodin) zjišťuje období z katalogu, obnovuje aktuální rok včetně oprav již publikovaných výkazů a doplňuje rozvahu/populaci. Pro počáteční kompletní historii slouží `npm run sync`; pro vynucené nové načtení celé historie `npm run sync -- --refresh`. SHA-256 deduplikace zajišťuje, že totožný dokument nevytvoří další snapshot. Chyba jednotlivého období je auditována a nevytlačí poslední ověřená data.

Pro trvalý provoz registrujte web i worker ve správci procesů nebo použijte přiložený Docker profil `app`:

```powershell
docker compose -p financni-radar-litvinova --profile app up -d --build
docker compose -p financni-radar-litvinova --profile app logs -f worker
# Po dokončení prvního importu, jednorázové načtení ověřeného CPI:
docker compose -p financni-radar-litvinova --profile app exec worker npm run data:cpi
```

Při přechodu z lokálního Node serveru uvolněte port 3100. Profil zahrnuje migraci před webem a workerem, opakovaný plný import při restartu je idempotentní. Lokální Docker profil je zachován; cloud používá nativní Node.js web na Renderu a databázi s ověřeným TLS v Neonu. Migrace proběhne před spuštěním webu. Denní aktualizátor běží jako plánovaná Neon Function nezávisle na uspání bezplatného webu.

## Funkce

- Přehled příjmů, výdajů, salda, provozního salda, investic, úvěrového dluhu, peněžních prostředků a čerpání.
- Schválený / upravený rozpočet / kumulativní skutečnost; historické rozpětí stejného měsíce za předchozích nejvýše pět let.
- Trendy uzavřených roků, horizont 1/3/5/10 let a celá historie; nominální Kč, ceny 2025, Kč na obyvatele a podíly.
- Čtrnáct transparentních indikátorů Trend Radar a popis každého výpočtu.
- Příjmy podle tříd a jednotlivých položek; výdaje od odvětví přes paragraf až k položce, včetně časové řady položky.
- Investice a finanční zdraví bez arbitrárního souhrnného skóre.
- Signály meziročních změn, historického průměru, sezónnosti, struktury, dlouhodobého vývoje, skoků položek a růstu nad celkovými výdaji či CPI. Prahy i použitá období jsou uvedené u signálu.
- Globální filtry, sdílitelná URL, CSV export, světlý/tmavý režim a mobilní navigace.
- Analytik se čtyřmi definovanými deterministickými SQL nástroji; zdrojový údaj, výpočet a interpretace jsou oddělené.

## Ověřená data a metodika

K **10. 10. 2026** je načteno **97 ze 97 publikovaných období FIN od 2010 do srpna 2026** a **57 z 57 publikovaných rozvah od 2010 do června 2026**, včetně všech historických čtvrtletí. Počty obyvatel pokrývají 2010–2026 a roční CPI 2010–2025. Katalog může nabídnout více období později; UI i worker dostupnost zjišťují dynamicky.

Oficiální [katalog MONITOR](https://monitor.statnipokladna.gov.cz/api/opendata/monitor), [WSDL](https://monitor.statnipokladna.gov.cz/api/monitorws?wsdl), XML číselníky a oficiální CSV distribuce ZIP/RAR. SOAP FIN má do 2025 kód 051, od 2026 kód 063. Starší období FIN i rozvah bez SOAP pokrývá import oficiálního CSV archivu. Rozvaha za březen 2013 používá RAR navzdory příponě ZIP a tisíce Kč; parser ověřuje skutečný formát, IČO, období, účty a účetní identitu. Žádný scraping HTML.

Kontrolní příklad **31. 8. 2026**, konsolidovaná skutečnost: příjmy **638 098 639,41 Kč**, výdaje **862 113 904,62 Kč**, saldo **−224 015 265,21 Kč**, financování **224 015 265,21 Kč**. Provozní saldo **94 666 599,62 Kč**, kapitálové výdaje **332 496 340,20 Kč**. Hodnoty jsou kumulativní, měsíce se nesčítají.

Roční schválený a upravený rozpočet se porovnává s průběžnou skutečností. Sezónní rozpětí je min–max, nikoli statistický interval spolehlivosti; k vyhodnocení je nutné minimum tří pozorování. Saldo neoznačujeme jako procento čerpání. Dluh a peněžní prostředky mají vlastní datum rozvahy; peněžní prostředky mohou být účelově vázané a úvěrový dluh není úplný zákonný ukazatel zadlužení.

Částky normalizujeme na přesné celočíselné haléře a konsolidujeme pomocí časově platných `kon_pol`. Původní řetězce zůstávají uložené. CSV za březen 2013 je publikováno v tisících Kč: explicitní konverze ×1000 zachovává původní hodnotu. Staré zaokrouhlené zdroje mají zdokumentovanou toleranci; nezaokrouhlené SOAP výkazy se kontrolují přesně.

CPI pochází z [oficiálního ročního přehledu ČSÚ](https://csu.gov.cz/docs/107508/a3bcc692-1894-b309-99d1-470e95b65144/inflace_2000_2025.pdf). CSV `data-sources/csu-annual-inflation.csv` bylo porovnáno s tímto dokumentem, původní PDF je archivováno v RAW. Index je zřetězen zpět od 2025 = 100. Aktualizace ročního CPI vyžaduje ověřit další oficiální roční vydání a upravit importér i referenční rok; není předstírána automatická aktualizace budoucího CPI.

## Architektura a API

Podrobnosti: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

`RAW → NORMALIZED → ANALYTICS`: neměnné SHA-256 snapshoty, normalizovaná fakta s původními hodnotami, agregace vázané na snapshot. Publikaci určuje `active_statement` až po úspěšné validaci. Veřejné DB pohledy explicitně vylučují `visibility=internal`. Synchronizace a migrace mají advisory lock; aktualizace probíhá transakčně. Stav a chyby jsou v `sync_run`, kontroly v `validation_result`.

- `GET /api/analytics?period=2026-08-31&paragraph=2212&scope=capital`: ověřená analytika; další filtry `item`, `flow`.
- `GET /api/export?...`: CSV s původem a snapshotem, ochrana proti spreadsheet formula injection.
- `POST /api/analyst`: JSON `{ "question": "Jak se změnily výdaje na dopravu za deset let?", "period": "2026-08-31" }`.
- `POST /api/sync`: vyžaduje hlavičku `Authorization: Bearer <SYNC_TOKEN>`. Token nesmí být ve veřejném klientovi.

Všechny datové stránky, API a exporty vyžadují přihlášení serverovou cookie. Synchronizace navíc vyžaduje administrátorský token. Přístupové heslo není uloženo v klientovi; `.env` obsahuje scrypt hash a náhodný klíč relace. Chybějící konfigurace přístup neotevře. Web je nasazený na Render Free; cloudová databáze, 61 soukromých RAW archivů a denní aktualizátor jsou nasazené v uživatelově projektu Neon Free. Podrobnosti a přístup vlastníka jsou v [docs/CLOUD.md](docs/CLOUD.md); konfigurace je v `render.yaml` a `neon.ts`, identifikátory bez secrets v `deploy/`.

## Testy a kontrola

```powershell
npm run typecheck
npm test
$env:SOURCE_TESTS='1'
$env:INTEGRATION_TESTS='1'
npm test
npm run verify
npm run build
# S běžícím serverem na portu 3100:
# SMOKE_PASSWORD nastavte dočasně na aktuální vstupní heslo; neukládejte jej do Gitu.
npm run test:smoke
```

Zdrojový test 2025 používá XML uložené v této instalaci (`data/research`); na čisté instalaci lze zdrojové fixtures opět získat pomocí `npm run test:prepare-sources`. Běžné unit testy je nevyžadují. Integrační test potřebuje naplněnou lokální DB. Test veřejného/interního oddělení běží v transakci s rollbackem; produkční data nemění. `verify` znovu počítá aktivní SOAP zdroje a porovnává uložené agregace; CSV mají reconciliation přímo v ETL. Ověřeno 988 agregací (vždy schválený, upravený a skutečný objem) proti SOAP, opakovaný import beze změny vytvořil 0 nových výkazů.

Kontrola opravy importéru: 19 testů prošlo, jeden volitelný integrační test byl vynechán. TypeScript, čisté Linux npm ci i produkční sestavení prošly. HTTP kontrola ověřila všech 10 stránek, správné KPI a filtry, CSV, odmítnutí neautorizované synchronizace a všechny 4 analytické nástroje. V prohlížeči byly ověřeny drill-down, přenos filtrů mezi stránkami, světlý/tmavý režim, mobilní navigace a odstranění staré odpovědi analytika při změně období. Při mobilním i desktopovém viewportu nepřetéká dokument vodorovně; široké tabulky mají vlastní posuvník. Náhledy jsou v lokálním `artifacts/` (nejsou v Gitu).

## Připravené návaznosti a omezení

**TODO – budoucí adaptéry:** GINIS/ORG/odbor/investiční akce, rozpočtová opatření a dokumenty města, výhled, další města a medián skupiny, jazykový model používající registrované nástroje. Tyto vstupy nejsou připojené a aplikace je jasně označuje jako nedostupné. Analytik již odpovídá skutečnými SQL výsledky; obecné přirozené dotazy mimo čtyři nástroje vyžadují budoucí modelový adaptér. Volné SQL nebo vymyšlené příčiny nejsou povolené.

Zálohujte PostgreSQL (např. `pg_dump`) i adresář `data/raw` s původními objemnými ZIP distribucemi. Payload SOAP, vybrané původní CSV řádky, kontrolní manifesty a dokument ČSÚ jsou zároveň v PostgreSQL. Při změně schématu zdroje neobcházejte validaci: doplňte verzovaný parser a kontrolní test.

Kontrola MONITORu dne 10. 10. 2026: doplněno 40 chybějících čtvrtletních rozvah. Katalog a produkční databáze obsahují shodně 97 rozpočtových období a 57 rozvah bez chybějícího období. Nejnovější FIN je 31. 8. 2026, rozvaha 30. 6. 2026. Všech 8688 účetních částek souhlasí s RAW zdroji, všech 57 rozvah má shodná aktiva a pasiva a všech 2 910 přímo sečtených rozpočtových hodnot souhlasí s agregacemi. Samostatné ověření SOAP porovnalo 988 agregací / 2 964 částek. V soukromém úložišti je ověřeno 61 archivů, 1 137 520 755 bajtů. Denní aktualizace 10. 10. 2026 v 03:17 UTC skončila úspěšně (run 20, nasazení funkce 3). Podrobnosti: [docs/MONITOR-AUDIT.md](docs/MONITOR-AUDIT.md).

Počáteční cloudová kontrola dne 2. 10. 2026: všech 14 zdrojových, databázových a aplikačních testů prošlo; čisté Linux `npm ci` a produkční sestavení prošly. Render nasadil commit `1e009067d0fc46e8db0a8879af7b6fab3ff28d19` a deployment je `live`. Celá HTTP sada prošla přímo na veřejné HTTPS adrese: skutečné přihlášení a odhlášení, všech deset stránek, přesná KPI, filtry, CSV, všechny čtyři analytické nástroje, anonymní blokace, podvržené relace, CSRF, limit přihlašovacích pokusů a Secure/HttpOnly/SameSite cookie. Přihlášení a načtená data byly nezávisle ověřeny v prohlížeči. Anonymní `/api/health` vrací pouze stav `ok`.

