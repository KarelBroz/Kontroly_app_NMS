# Kontroly MS

Interní webová aplikace **NMS Market Research** pro kontrolu dat z projektů mystery shoppingu (MS) — ověřuje, že mystery shopper vyplnil report/dotazník správně a v souladu se zadaným scénářem návštěvy.

## Datová hierarchie

```
Projekt
 └─ Vlna (Wave) — 1..N na projekt
     ├─ Scénář vlny (strukturovaná data)
     ├─ Import dat (opakovaně nahrávané soubory)
     └─ Návštěvy (Visits) — 1..N na vlnu, identifikované unikátním InspectionId
```

Import se dělá na úrovni vlny a lze ho nahrávat opakovaně. Detaily deduplikace jsou popsané níže.

## Stack

- **Next.js 14 (App Router) + TypeScript** — frontend i API v jednom projektu
- **PostgreSQL (Neon) + Prisma ORM**
- **NextAuth (Auth.js)** — přihlášení e-mailem a heslem, registrace omezená na `@nms.eu`
- **Resend** — odesílání e-mailů (zapomenuté heslo)
- **Tailwind CSS**
- `xlsx` — parsování Excel/CSV importů

## Architektura importu dat

Import je navržen jako vyměnitelná vrstva v [`src/lib/import`](src/lib/import) přes rozhraní `ImportSource`:

- **`ExcelCsvImportSource`** — aktuální implementace, upload Excel/CSV souboru.
- V budoucnu (~6 měsíců) přibude **`NavigatorApiImportSource`** pro napojení na interní systém **Navigátor** přes API — beze změny zbytku appky, jen nová implementace `ImportSource`.

Import na úrovni vlny porovnává příchozí řádky s tím, co už ve vlně existuje, podle `inspectionId`:

- **nové `inspectionId`** → přidá se návštěva a rovnou se zkontroluje proti pravidlům vlny,
- **existující beze změny obsahu** (dle `contentHash`, hash všech importovaných polí) → přeskočí se,
- **existující se změněným obsahem** → data se aktualizují, staré nálezy k návštěvě se smažou a kontrola proběhne znovu.

## Scénáře a pravidla kontroly

Vlna může mít 1..N **scénářů** (instance sdílených `ScenarioTemplate` daného projektu, např. "Cestovní pojištění 2026"). Každý scénář nese jen okno terénu (**Start terénu** / **Konec terénu**) a má svoje vlastní pravidla — nová pravidla lze při zakládání scénáře nakopírovat z jiného existujícího (viz `copyRulesToScenario` v `src/app/(app)/projects/[projectId]/waves/[waveId]/actions.ts`).

Import CSV/Excel má v prvním řádku názvy sloupců — buď pomocné (např. `RealDate`), nebo odpověď na otázku ve formátu `KÓD: textace` (např. `X20: Délka celé návštěvy (minuty)`). Pravidla se zadávají podle **kódu otázky** (`src/lib/rules/matchQuestion.ts` najde sloupec podle části před dvojtečkou), ne podle celé textace. Tři typy pravidel, logika v [`src/lib/rules`](src/lib/rules):

- `REQUIRED` — otázka nesmí být prázdná
- `ALLOWED_VALUES` — odpověď musí být jedna z povoleného seznamu hodnot
- `NUMERIC_RANGE` — odpověď musí být číslo v zadaném rozsahu

Kromě ručně nastavených pravidel běží **vždy a všude** (napříč všemi projekty/vlnami, bez konfigurace) dvě automatické kontroly v `runRulesForVisit`:

- **Datum návštěvy** — sloupec `RealDate` musí spadat do okna terénu scénáře (Start/Konec terénu).
- **Překlepy/pravopis** — lehká offline heuristika (opakující se písmeno/slovo, vícenásobné mezery) nad každou textovou odpovědí; nálezy jsou vždy `MEDIUM` (žlutá), v přehledu nálezů se chybné slovo zvýrazňuje červeně přímo v kontextu. Zatím bez AI (viz "Budoucí rozšíření") — chytá jen zjevné mechanické chyby, ne skutečnou gramatiku/pravopis.

Kontrola běží automaticky při importu (na nových/změněných řádcích) a lze ji ručně spustit znovu nad celou vlnou nebo jedním scénářem.

## Lokální spuštění

Vyžaduje Node.js 20+ a přístup k PostgreSQL databázi (např. Neon).

```bash
npm install
cp .env.example .env   # doplň DATABASE_URL a NEXTAUTH_SECRET
npm run db:push        # promítne Prisma schema do databáze
npm run dev
```

Appka poběží na http://localhost:3000. První účet si založíš na `/register` (jen s e-mailem `@nms.eu`).

## Přihlašování a obnovení hesla

- Registrace (`/register`) je omezená na e-maily s doménou `@nms.eu`, a k dokončení potřebuje JEDNU ze dvou věcí:
  - **Předem povolený e-mail** — spravuje se na `/users` (kdokoliv přihlášený, zatím bez rolí), tabulka `AllowedRegistrationEmail`. Účet se založí rovnou, bez kódu — identitu v tomhle případě ověřuje ten, kdo adresu na `/users` přidal. Zůstává jako rychlá cesta i natrvalo, ne jen dočasná náhrada za e-mail.
  - **Ověření e-mailu 6místným kódem** (`/register/verify`) — bez zadání kódu zaslaného na danou adresu se `User` vůbec nezaloží (drží se jako `PendingRegistration` max. 15 minut, max. 5 pokusů na kód).
- Zapomenuté heslo (`/forgot-password`) pošle uživateli e-mail s časově omezeným odkazem (60 minut, jednorázový token — hash v DB, syrová hodnota jen v odkazu) na `/reset-password`, kde si nastaví nové heslo.
- E-maily posílá [Resend](https://resend.com) přes `src/lib/mail/sendMail.ts` (čistý `fetch`, žádná další závislost). Bez nastaveného `RESEND_API_KEY` appka požadavek na reset přijme (kvůli ochraně proti zjišťování existujících účtů vždy ukáže stejnou "odesláno" hlášku), ale e-mail reálně neodejde — chyba se jen zaloguje.

## Nasazení (Vercel + Neon)

1. Založ projekt na [Neon](https://neon.tech), zkopíruj **pooled** connection string.
2. Repo připoj na [Vercel](https://vercel.com) (import z GitHubu) — auto-deploy při push do `main`.
3. Ve Vercel → Project Settings → Environment Variables nastav pro všechna prostředí (Production, Preview, Development):
   - `DATABASE_URL` — connection string z Neonu
   - `NEXTAUTH_URL` — veřejná URL appky
   - `NEXTAUTH_SECRET` — vygeneruj přes `openssl rand -base64 32`
   - `NEXT_PUBLIC_APP_URL` — veřejná URL appky
   - `RESEND_API_KEY` — API klíč z [resend.com](https://resend.com) (jinak nepůjde odesílat e-maily pro obnovení hesla)
   - `MAIL_FROM` — odesílací adresa, do ověření vlastní domény v Resendu stačí `Kontroly MS <onboarding@resend.dev>`
4. Build krok (`npm run build`) při každém deployi spustí `prisma generate` a `prisma db push --accept-data-loss`, takže databázové schéma se drží synchronizované automaticky, bez nutnosti ručně spouštět migrace.
   ⚠️ **`--accept-data-loss` je kompromis pro tuhle fázi vývoje** — bez něj `db push` odmítne i neškodné změny (např. přidání `UNIQUE` na sloupec, kde existující řádky mají `NULL`), a build spadne. Jakmile v appce budou reálná klientská data, **přejdi na `prisma migrate deploy` s verzovanými migračními soubory** (vyžaduje generovat migrace přes `prisma migrate dev` — tedy Node.js lokálně, nebo řízeně přes CI), ať žádná schema změna nemůže tiše smazat produkční data.

Appka nemá natvrdo zadanou doménu — vše jde přes env proměnné (`NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`), takže napojení na jiný web NMS půjde udělat bez zásahu do kódu.

## Budoucí rozšíření

- **Napojení na Navigátor** — druhý `ImportSource` (API místo souboru), viz `src/lib/import`.
- **Role uživatelů** — `User` model je připravený na přidání pole `role` bez velké přestavby.
- **Migrace místo `db push`** — až bude appka v ostrém provozu s reálnými daty.
- **Kontrola gramatiky přes AI** — offline heuristika chytá jen mechanické chyby; přesnější kontrola (skutečná gramatika/pravopis) by šla přes Claude API (`ANTHROPIC_API_KEY`), zatím vědomě odloženo kvůli nákladům a rychlosti importu velkých dávek dat.
