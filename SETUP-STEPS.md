# Bilbingo setup guide

Detta är en enkel steg-för-steg-guide. Följ den i ordning.

## 1. Installera Node.js

Du behöver Node.js för att köra appen lokalt.

Om du använder Windows:
- Ladda ner Node.js LTS från https://nodejs.org/
- Installera det
- Starta om terminalen

Kontrollera att det fungerar:
```bash
node -v
npm -v
```

## 2. Öppna projektet i terminalen

I terminalen, gå till projektmappen:
```bash
cd c:\Repos\Bilbingo
```

## 3. Installera projektets beroenden

Kör detta i projektmappen:
```bash
npm install
```

## 4. Skapa Supabase-projekt

Gör detta i webbläsaren på https://supabase.com:
1. Skapa ett nytt projekt
2. Välj ett namn
3. Välj en region
4. Skapa projektet

När projektet är klart, kopiera:
- Project URL
- publishable key
- secret key

## 5. Skapa miljöfil för appen

I projektmappen, skapa en fil som heter `.env.local`.

Skriv in detta:
```env
NEXT_PUBLIC_SUPABASE_URL=din_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=din_publishable_key
SUPABASE_SECRET_KEY=din_secret_key
DEFAULT_USER_ID=valfritt_uuid
```

> Skriv inte in dessa i GitHub eller dela dem offentligt.

## 6. Skapa tabeller i Supabase

Gör detta i Supabase Dashboard → SQL Editor.

Öppna filen `supabase-schema.sql` i projektet och kör innehållet där:

```sql
-- se supabase-schema.sql
```

Klicka på Run.

## 7. Starta appen lokalt

I terminalen:
```bash
cd c:\Repos\Bilbingo
npm run dev
```

Öppna sedan:
```text
http://localhost:3000
```

## 8. Skapa ett konto i appen

När appen öppnas:
1. Klicka på "Skapa konto"
2. Skriv e-post och lösenord
3. Logga in

## 9. Lägg till data

När du är inloggad:
- skapa kategorier
- lägg till föremål
- testa generatorn

## 10. Deploya till Vercel (valfritt)

När du vill ha appen online:
1. Gå till https://vercel.com
2. Importera repot
3. Lägg till samma miljövariabler i Vercel
4. Deploya

## 11. Vanliga problem

Om appen inte startar:
- kontrollera att Node.js är installerat
- kontrollera att `.env.local` finns
- kontrollera att Supabase-tabellerna skapades
- kontrollera att `npm install` blev klar utan fel
