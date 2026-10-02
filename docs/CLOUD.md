# Cloudové nasazení a přístup vlastníka

Zvolená varianta je **Render Free + Neon Free**, bez placeného workeru, disku nebo databáze Render s třicetidenní platností. Změna na placený tarif vyžaduje nový výslovný souhlas vlastníka.

## Vlastnictví a stav

- Zdrojový repozitář: [Amonix1/radar](https://github.com/Amonix1/radar), vlastníkův existující repozitář. `.env*`, `data/`, `artifacts/` a `dist/` jsou vyloučené z Gitu.
- Web: [financni-radar-litvinova.onrender.com](https://financni-radar-litvinova.onrender.com), Render Free, potvrzený prostor **Tomáš's workspace** (`tea-davvm06gekts73fkl3p0`). [Správa webu v Renderu](https://dashboard.render.com/web/srv-db00ki3ncjis738153q0). Nasazení `dep-db00kj3ncjis738156j0` je `live`, zdrojový commit `1e009067d0fc46e8db0a8879af7b6fab3ff28d19`. Vlastník se do správy přihlašuje svým Render účtem; heslo aplikace tuto správu neotevírá.
- Databáze a soukromé RAW úložiště: projekt **radar**, Neon Free, Frankfurt, `summer-pond-52900241`, produkční větev `br-nameless-boat-b1gtu1sk`. Vlastník má oprávnění ADMIN. [Správa Neon projektu](https://console.neon.tech/app/projects/summer-pond-52900241).
- Aktualizátor `radarsync` je nasazený na Neon Functions, Node.js 24. Plán je aktivní každý den v 03:17 UTC; první dva skutečné plánované běhy dne 2. 10. 2026 skončily úspěšně. V soukromém bucketu `radar-raw` je všech 21 archivů, celkem 309 242 951 bajtů.

## Provoz v bezplatných limitech

Neon Free nemá třicetidenní expiraci. K 2. 10. 2026 zahrnuje 1 GB databáze na projekt, 100 CU-h výpočtu měsíčně, 5 GB soukromého objektového úložiště a limity funkcí/přenosů podle aktuálního ceníku. Archivátor odmítne nové soubory po dosažení 4 GB evidovaných archivů; nic nemaže ani automaticky neupgraduje. Přenesená databáze má přibližně 34 MB a původní ZIP archivy přibližně 309 MB. [Neon Free](https://neon.com/docs/introduction/free-tier), [ceník](https://neon.com/pricing).

Render Free web po nečinnosti uspí; první otevření může trvat přibližně minutu. Zahrnuje 750 provozních hodin měsíčně pro celý workspace. Bezplatnost platí v limitech poskytovatelů a podle jejich současných podmínek; budoucí cenovou politiku nelze garantovat. [Render Free](https://render.com/docs/free).

## Nastavení a nasazení

`render.yaml` obsahuje pouze web `plan: free`, Node.js 22, sestavení `npm ci --include=dev && npm run build`, start `npm run cloud:web`, region Frankfurt a health endpoint `/api/health`. Web byl vytvořen přímo přes Render nástroj se stejným build/start nastavením; nástroj neumožňuje nastavit HTTP health path, aktuální služba proto používá výchozí TCP health check. Aplikační `/api/health` byl nezávisle ověřen přes veřejné HTTPS. Start migruje schéma a připojí statické soubory standalone sestavení. PostgreSQL je externí a používá ověřené TLS. Automatické deploye jsou vypnuté; po změně zdrojů vlastník spustí Manual Deploy v Dashboardu. Identifikátory služby jsou v `deploy/render-service.json`.

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

Zdrojové soubory byly publikovány do vlastníkovy větve `main` na GitHubu; obsah všech 78 souborů byl ověřen shodným Git tree SHA proti lokální otestované verzi. Secrets ani datové archivy nebyly publikovány. Render build i spuštění prošly, nasazení je `live` a celá HTTP sada prošla na skutečné veřejné HTTPS adrese včetně Secure cookie. V prohlížeči bylo ověřeno přihlášení požadovaným heslem a zobrazení skutečných cloudových dat. Lokální důkaz je `artifacts/cloud-live.png`. Původní lokální větev `codex/cloud-deployment` je zachována.

Při změně přístupového hesla použít `npm run access:configure`, aktualizovat produkční hash i podpisový klíč a restartovat web. Roční CPI vyžaduje kontrolu nového oficiálního vydání podle README.
