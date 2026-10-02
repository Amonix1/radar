# Cloudové nasazení a přístup vlastníka

Zvolená varianta je **Render Free + Neon Free**, bez placeného workeru, disku nebo databáze Render s třicetidenní platností. Změna na placený tarif vyžaduje nový výslovný souhlas vlastníka.

## Vlastnictví a stav

- Zdrojový repozitář: [Amonix1/radar](https://github.com/Amonix1/radar), vlastníkův existující repozitář. `.env*`, `data/`, `artifacts/` a `dist/` jsou vyloučené z Gitu.
- Web: Render, potvrzený prostor **Tomáš's workspace** (`tea-davvm06gekts73fkl3p0`). Web ještě není vytvořený; pro publikaci zdrojů zbývá přihlášení pro zápis do GitHubu. [Render Dashboard](https://dashboard.render.com/).
- Databáze a soukromé RAW úložiště: projekt **radar**, Neon Free, Frankfurt, `summer-pond-52900241`, produkční větev `br-nameless-boat-b1gtu1sk`. Vlastník má oprávnění ADMIN. [Správa Neon projektu](https://console.neon.tech/app/projects/summer-pond-52900241).
- Aktualizátor `radarsync` je nasazený na Neon Functions, Node.js 24. Plán je aktivní každý den v 03:17 UTC; první dva skutečné plánované běhy dne 2. 10. 2026 skončily úspěšně. V soukromém bucketu `radar-raw` je všech 21 archivů, celkem 309 242 951 bajtů.

## Provoz v bezplatných limitech

Neon Free nemá třicetidenní expiraci. K 2. 10. 2026 zahrnuje 1 GB databáze na projekt, 100 CU-h výpočtu měsíčně, 5 GB soukromého objektového úložiště a limity funkcí/přenosů podle aktuálního ceníku. Archivátor odmítne nové soubory po dosažení 4 GB evidovaných archivů; nic nemaže ani automaticky neupgraduje. Přenesená databáze má přibližně 34 MB a původní ZIP archivy přibližně 309 MB. [Neon Free](https://neon.com/docs/introduction/free-tier), [ceník](https://neon.com/pricing).

Render Free web po nečinnosti uspí; první otevření může trvat přibližně minutu. Zahrnuje 750 provozních hodin měsíčně pro celý workspace. Bezplatnost platí v limitech poskytovatelů a podle jejich současných podmínek; budoucí cenovou politiku nelze garantovat. [Render Free](https://render.com/docs/free).

## Nastavení a nasazení

`render.yaml` obsahuje pouze web `plan: free`, Node.js 22, sestavení `npm ci && npm run build`, start `npm run cloud:web`, region Frankfurt a health endpoint `/api/health`. Start migruje schéma a připojí statické soubory standalone sestavení. PostgreSQL je externí a používá ověřené TLS.

Do nastavení Render webu patří pouze:

- `DATABASE_URL`: přímé Neon připojení, případně `DATABASE_URL_UNPOOLED`. Session advisory locks vyžadují přímé PostgreSQL připojení; aplikace odstraňuje Neon `-pooler` hostname a používá `sslmode=verify-full`.
- `APP_PASSWORD_HASH`: scrypt hash požadovaného hesla; přenést pouze do serverových secrets.
- `APP_SESSION_SECRET`: nový náhodný produkční podpisový klíč, alespoň 43 znaků.
- `SYNC_TOKEN`: samostatný náhodný administrátorský token.
- `APP_ORIGIN`: start odvodí HTTPS origin z `RENDER_EXTERNAL_HOSTNAME`. Lokální HTTP origin do cloudu nekopírovat.

Web nepotřebuje úložné přístupové klíče. Neon Function dostává databázové a S3 připojení automaticky, explicitní nastavení je jen `RAW_STORAGE_BUCKET=radar-raw`. Jednorázová přenosová S3 credential má pouze storage read/write a po ověření přenosu se zruší.

Neon konfigurace je v `neon.ts`, identifikátory bez tajných hodnot v `deploy/neon-project.json`. CLI může vlastník propojit příkazem `neon link --project-id summer-pond-52900241 --branch production -y`; zachovat oddělené lokální a cloudové secrets. Nasazení lze provést připojeným Neon nástrojem nebo `neon deploy`. Jednotlivý aktualizátor lze sestavit příkazem `npm run cloud:bundle`; `dist/radarsync.zip` obsahuje pouze kód, bez `.env` a datových souborů.

## Přihlášení a aktualizace

Server kontroluje přihlášení před načtením dat. API a exporty samostatně ověřují podepsanou relaci. Cookie je HttpOnly, SameSite=Strict, přes HTTPS Secure, platnost 12 hodin. Změna heslového hashe nebo podpisového klíče zruší existující relace. Přihlášení a odhlášení ověřují origin; přihlášení má databázový limit pokusů. Správa cloudu používá osobní účet vlastníka, nesdílí vstupní heslo aplikace.

Denní aktualizátor načte aktuální rok včetně oprav již publikovaných výkazů, rozvahy a populace. Vyžaduje důvěryhodnou hlavičku `X-Neon-Trigger-Invocation-Id`; Neon odstraní klientem podvržené hlavičky tohoto typu. Veřejné volání i podvržení byly na nasazené funkci odmítnuty stavem 403. Výsledek je auditovaný v `sync_run` a `scheduled_sync`; úspěšně zpracovaná occurrence je při opakovaném doručení no-op. Advisory locks brání souběhu. Chyba nevytlačí poslední ověřená finanční data.

Původní ZIP distribuce jsou uloženy pod SHA-256 klíčem `archives/<sha256>.zip`. Aplikace před přenosem kontroluje skutečný obsah a po přenosu délku a hash v metadatech. Existující objekt nikdy nepřepisuje; zápisy jsou serializované databázovým zámkem. `raw_archive` je neměnný katalog. Jde o ochranu v aplikaci, nikoliv zaručený S3 Object Lock; správce může soubory změnit ve svém účtu.

## Obnova a ověření před předáním

Počáteční přenos používá PostgreSQL custom dump bez hesel a bez dat přihlašovacích pokusů. Dump byl úspěšně obnoven do prázdné produkční databáze; původní lokální databáze zůstává zachována. Free plán Neonu má omezené šestihodinové okno obnovy historie. RAW úložiště u stejného poskytovatele nenahrazuje nezávislou zálohu; aktuální nezávislou kopii má vlastník v lokálním `data/raw` a `artifacts/radar-initial.dump`. Pravidelné nezávislé zálohy nejsou tímto nastavením předstírané. [Obnova větve](https://neon.com/docs/introduction/branch-restore).

Ověřeno: 97 rozpočtových období a 17 rozvah v cloudu, přesná KPI, všech deset stránek, filtry, CSV, čtyři analytické nástroje, skutečné přihlášení požadovaným heslem, anonymní blokace API i podvržených relací, CSRF a logout. Produkční Linux kontejner připojený ke skutečnému Neonu prošel celou HTTP sadou i v limitu 512 MB / 0,5 CPU. Všech 14 zdrojových, databázových a aplikačních testů prošlo; čisté Linux `npm ci` a produkční sestavení prošly. V úložišti byla ověřena metadata všech 21 souborů a skutečný SHA-256 staženého prvního i posledního archivu; anonymní čtení vrací 403. Poslední cloudová funkce ověřila dostupnost S3 a úspěšně provedla plánované importy v 19:27 a 19:28 UTC dne 2. 10. 2026. Dočasná přenosová credential byla zrušena.

Zbývá publikace zdrojů do GitHubu a Render web deploy, poté kontrola finální veřejné HTTPS adresy a Secure cookie. Lokální náhled sám potvrzením nasazení není. Pokus `git push origin HEAD:main` skončil chybou chybějícího GitHub přihlášení; zdroj je bezpečně uložený v lokální větvi `codex/cloud-deployment`.

Při změně přístupového hesla použít `npm run access:configure`, aktualizovat produkční hash i podpisový klíč a restartovat web. Roční CPI vyžaduje kontrolu nového oficiálního vydání podle README.
