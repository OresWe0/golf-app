# Golfrundan - Next.js + Supabase

Det här är version 2.1 av golf-webbappen med:

- login och registrering via Supabase Auth
- egna användarkonton för dig och dina golfvänner
- HCP i registrering och profil
- standard-tee per användare
- delade rundor där flera registrerade användare kan vara kopplade till samma runda
- val av bana med förifyllda håldata
- hole-by-hole-flöde: start på hål 1, sedan hål 2 osv.
- stöd för slagspel och Stableford
- summering per spelare efter rundan
- stöd för både registrerade spelare och gäster i samma boll
- spel-HCP som räknas ut från tee-data i seedad bana

## Tech stack

- Next.js App Router
- React
- Supabase Auth + Postgres

## Kom igång

1. Skapa ett nytt Supabase-projekt.
2. Kör `supabase/schema.sql` i SQL Editor.
3. Kör `supabase/seed.sql` i SQL Editor.
4. Kopiera `.env.example` till `.env.local` och fyll i värdena.
5. Installera paket:

```bash
npm install
```

6. Starta lokalt:

```bash
npm run dev
```

7. Öppna `http://localhost:3000`.

## Viktigt vid uppgradering

Om du redan har kört en tidigare version av databasen är det enklast att:

- antingen skapa ett nytt Supabase-projekt
- eller köra `schema.sql` igen så att nya kolumner/tabeller läggs till
- och sedan köra `seed.sql` igen

## Delade rundor

När du skapar en ny runda kan du lägga till spelare på två sätt:

- **Registrerad spelare**: ange namn + e-post till en vän som redan har konto i appen
- **Gäst**: ange bara namn

Om e-postadressen matchar en registrerad användare:

- spelaren kopplas till rundan
- rundan syns på den spelarens dashboard
- spelaren kan logga in och registrera score i samma runda

## HCP och tee

- användaren kan ange HCP vid registrering
- användaren kan ändra HCP och standardtee på `/profile`
- när en ny runda skapas används profilens HCP och tee som standard
- du kan justera HCP och tee per spelare innan rundan startar
- appen räknar sedan ut spel-HCP för rundan
- erhållna slag per hål fördelas efter hålets index

## Viktigt om Kårsta GK

Projektet är uppdaterat för att använda seedad Kårsta-data med par/index och tee-data. Kontrollera alltid mot klubbens senaste officiella scorekort/slopetabell innan skarp drift om klubben har gjort ändringar.

## Rekommenderad nästa nivå

- sök/autocomplete för registrerade vänner när du bjuder in spelare
- e-postinbjudningar med länk till rundan
- adminvy för att redigera banor och hål
- PWA-stöd för hemskärmsinstallation
- statistik över rundor och handicapnära vyer
