# ZestPad

Caietul digital al clasei. Elevul scrie de mână cu stylus, profesorul dă și
corectează teme, părintele vede ce se întâmplă.

Rescriere completă a versiunii `zestpad-backend` + `zestpad-web` într-o singură
aplicație Next.js.

## Ce s-a schimbat față de versiunea veche

| Problemă în vechiul cod | Rezolvare |
|---|---|
| Prisma **și** TypeORM pe aceeași bază, cu nume de tabele diferite | Doar Prisma. Cauza probabilă a erorilor SIGTERM la deploy. |
| `synchronize: true` în producție (modifică schema la fiecare boot) | Migrări explicite Prisma. |
| Două repo-uri, două deploy-uri (Railway + Vercel) | O aplicație, un deploy. |
| Orice utilizator logat putea scrie în orice clasă | Strat de autorizare pe fiecare rută (`src/lib/access.ts`). |
| `CORS origin: '*'` | Same-origin; nu mai e nevoie de CORS. |
| Token în `localStorage` (vulnerabil la XSS) | Cookie `httpOnly`, `SameSite=Lax`. |
| `POST /classes/join` apelat de frontend, inexistent în backend | Implementat. |
| Rute frontend rupte (`/folder/:id` vs `/topic/:id`) | Rute consistente, în română. |
| `react-canvas-draw` — abandonat, fără presiune, fără palm rejection | Canvas propriu: Pointer Events + `perfect-freehand`. |
| Fără flux de teme | Temă → copie per elev → predare → corectură pe strat separat → notă. |
| Fără rol de părinte | Implementat, cu legare prin cod. |
| Pierzi tot ce ai scris dacă pică netul | IndexedDB + coadă de sincronizare + PWA. |

## Pornire

Ai nevoie de Node 18+ și un PostgreSQL (local, Supabase, Neon sau Railway).

```bash
npm install
cp .env.example .env      # completează DATABASE_URL și JWT_SECRET
npm run db:push           # aplică schema
npm run db:seed           # date demo (opțional)
npm run dev
```

Conturi demo (parola `zestpad123`):

| Rol | Email |
|---|---|
| Profesor | `profesor@zestpad.demo` |
| Elev | `elev@zestpad.demo` |
| Elev 2 | `elev2@zestpad.demo` |
| Părinte | `parinte@zestpad.demo` |

Cod de înscriere la clasă: `MAT5B7`. Cod părinte pentru Andrei: `DEMO2345`.

## Deploy pe Vercel

Migrările rulează **automat la fiecare deploy** — `vercel.json` setează build
command-ul la `prisma generate && prisma migrate deploy && next build`.

Variabile de mediu necesare în Vercel (Settings → Environment Variables):

| Variabilă | Valoare |
|---|---|
| `DATABASE_URL` | Connection string-ul Postgres (Railway / Neon / Supabase) |
| `JWT_SECRET` | Minim 32 caractere. `openssl rand -base64 48` |

Ambele trebuie setate pe **Production**, **Preview** și **Development**, altfel
build-ul cade la pasul de migrare.

### Prima dată, dacă baza conține o schemă veche

Migrarea inițială presupune o bază goală. Dacă baza are deja tabele dintr-o
versiune anterioară, golește-o o singură dată:

```bash
export DATABASE_URL="postgresql://..."   # din Railway
npx prisma migrate reset --force --skip-seed
```

După asta, deploy-urile își aplică singure migrările.

### Modificări ulterioare de schemă

```bash
npx prisma migrate dev --name descrie_schimbarea   # local, creează migrarea
git add prisma/migrations && git commit && git push  # Vercel o aplică la deploy
```

Nu edita niciodată o migrare deja aplicată în producție — creează una nouă.

## Structura

```
src/
  app/
    (app)/            paginile autentificate
      panou/          dashboard profesor sau elev
      clasa/[id]/     capitolele clasei
      capitol/[id]/   lecțiile capitolului
      lectie/[id]/    tabla profesorului (+ /catalog = lucrările elevilor)
      tema/[id]/      lucrarea unui elev
      parinte/        panoul părintelui
    api/              rutele REST
  components/
    ZestCanvas.tsx    motorul de scris
    PaperBackground.tsx  liniaturile (SVG)
  lib/
    access.ts         cine are voie la ce
    strokes.ts        formatul traseelor
    offline.ts        IndexedDB + coada de sincronizare
    api.ts            client HTTP rezistent la căderi de rețea
```

## Modelul de date

```
User (TEACHER | STUDENT | PARENT)
 ├── Class            profesorul deține clasa
 │    ├── Enrollment  elevii înscriși (cod de 6 caractere)
 │    └── Topic       capitol, cu tip de liniatură
 │         └── Lesson  THEORY (scrie profesorul) | HOMEWORK
 │              └── Submission   o lucrare per elev
 ├── ParentChild      părinte ↔ copil (cod de 8 caractere)
 └── Notebook         caiet personal, privat implicit
```

## Cum funcționează scrisul

Traseele se stochează ca liste de puncte `[x, y, presiune]`, nu ca imagine:

```json
{ "v": 1, "width": 1240, "height": 1754,
  "strokes": [{ "id": "...", "color": "#1a1a1a", "size": 3,
                "points": [[100,200,0.4],[140,240,0.7]] }] }
```

Avantaje: fișiere mici, se pot sincroniza incremental, se pot re-randa la orice
rezoluție, și se pot analiza mai târziu (ex: reluarea scrierii pas cu pas).

Detalii care contează pe tabletă:

- **`touch-action: none`** — fără el, browserul face scroll în loc să deseneze.
- **`getCoalescedEvents()`** — recuperează punctele pe care browserul le comprimă;
  fără ele, scrisul rapid iese colțat.
- **Palm rejection** — din momentul în care apare un stylus, atingerile cu
  degetul sunt ignorate.
- **Presiune** — citită din `PointerEvent.pressure`; când device-ul nu o
  raportează, se folosește o valoare constantă în loc să se simuleze fals.

## Corectura temelor

Scrisul elevului și corectura profesorului sunt **două câmpuri separate**
(`content` și `feedback`). Profesorul desenează peste, cu roșu, dar nu modifică
nimic din ce a scris elevul. Elevul vede ambele straturi suprapuse.

## Offline

1. Se scrie întâi în IndexedDB, apoi se încearcă serverul.
2. Dacă serverul nu răspunde, mutația intră într-o coadă.
3. Coada se golește la revenirea conexiunii, la revenirea în aplicație și după
   fiecare salvare reușită.
4. Pentru aceeași resursă se păstrează doar ultima stare, nu istoricul.

Autosalvare la 2,5 secunde după ultima linie, plus la ieșirea din pagină.

## Mod kiosk pe tabletă Android

Nu e nevoie de ROM custom sau root. Android Enterprise Device Owner:

1. Factory reset pe tabletă.
2. La ecranul de bun venit, provisioning ca Device Owner (QR, NFC sau ADB:
   `adb shell dpm set-device-owner com.pachet/.AdminReceiver`).
3. În aplicația DPC: `startLockTask()` peste un WebView care încarcă ZestPad.
4. Ca Device Owner poți bloca instalarea de aplicații, dezactiva camera,
   controla update-urile și porni aplicația la `BOOT_COMPLETED`.

Aplicația e PWA, deci merge și instalată direct din Chrome, fără WebView propriu.

## Testare

```bash
npm run typecheck
node e2e-test.mjs     # necesită serverul pornit pe :3100
```

`e2e-test.mjs` verifică 59 de scenarii pe HTTP real: fluxul complet
profesor → elev → părinte, plus că autorizarea chiar blochează accesul
neautorizat (elev la clasa altuia, profesor la clasa colegului, părinte la
lucrarea altui copil, elev care încearcă să se noteze singur).

## Ce NU face, intenționat

Nu există analiză a stării emoționale după presiunea pe stylus. Regulamentul
european privind IA interzice sistemele care deduc emoții în instituțiile de
învățământ (Art. 5, aplicabil din februarie 2025), iar presiunea pe stilou nu
prezice starea psihică. Datele rămân ale școlii.
