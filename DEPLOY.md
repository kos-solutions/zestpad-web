# Deploy

Aplicația este live la **https://edu.kos-solutions.ro**

## Ce este deja configurat

| Element | Stare |
|---|---|
| Repo | `kos-solutions/zestpad-web`, ramura `main` |
| Ramură de rezervă cu vechiul cod Vite | `backup-vite` |
| Vercel | proiect `zestpad-web`, regiune `fra1` |
| Framework | forțat pe `nextjs` prin `vercel.json` |
| Bază de date | Postgres în Railway, proiect `zestpad-backend` |
| Migrări | rulează automat la fiecare deploy |
| `DATABASE_URL` | setat pe Production și Development |
| `JWT_SECRET` | setat pe Production și Development |
| Date demo | încărcate |

Deploy-ul se declanșează automat la fiecare `git push origin main`.

## De făcut manual (o singură dată)

**Variabilele pentru mediul Preview.** Vercel CLI nu le poate seta
neinteractiv pentru Preview. Fără ele, deploy-urile de pe alte ramuri
(inclusiv `backup-vite`) vor eșua la migrare. Producția nu e afectată.

Vercel → `zestpad-web` → Settings → Environment Variables → la fiecare
dintre `DATABASE_URL` și `JWT_SECRET`, bifează și **Preview**.

## Conturi demo

Parola pentru toate: `zestpad123`

| Rol | Email |
|---|---|
| Profesor | `profesor@zestpad.demo` |
| Elev | `elev@zestpad.demo` |
| Elev 2 | `elev2@zestpad.demo` |
| Părinte | `parinte@zestpad.demo` |

Cod de înscriere la clasă: `MAT5B7`. Cod părinte pentru Andrei: `DEMO2345`.

Ștergerea datelor demo: `npx prisma migrate reset --force --skip-seed`.

## Modificări de schemă

```bash
npx prisma migrate dev --name descrie_schimbarea   # local, creează migrarea
git add prisma/migrations && git commit && git push
```

Vercel aplică migrarea la build. Nu edita o migrare deja aplicată în
producție — creează una nouă.

## Rulare locală

```bash
npm install
# .env cu DATABASE_URL (din Railway, varianta publică) și JWT_SECRET
npm run dev
```

`DATABASE_URL` trebuie să fie `DATABASE_PUBLIC_URL` din Railway
(`gondola.proxy.rlwy.net`), nu cel intern (`postgres.railway.internal`) —
acela funcționează doar între servicii Railway.

## Verificare

`node verify-prod.mjs` din folderul părinte testează aplicația live: pagini
publice, autentificare pentru toate cele trei roluri, citirea datelor și
faptul că autorizarea blochează accesul neautorizat.

`node e2e-test.mjs` rulează 59 de scenarii pe un server local pornit pe
portul 3100.

## Dacă un build cade

| Eroare în log | Cauză | Rezolvare |
|---|---|---|
| `Can't reach database server` | URL intern Railway, sau baza suspendată | Folosește URL-ul public; verifică serviciul în Railway |
| `migrations recorded in the database diverge` | Migrări șterse sau editate după aplicare | `npx prisma migrate resolve` sau reset pe o bază de test |
| `JWT_SECRET lipseste sau e prea scurt` | Variabila nu e setată pe acel mediu | Adaug-o, apoi redeploy |
| Build rulează Vite | `vercel.json` lipsește din root | Verifică `git ls-files vercel.json` |

Loguri: Vercel → Deployments → click pe deploy → Building.

## De urmărit: conexiunile la baza de date

`DATABASE_URL` include deja `connection_limit=1&pool_timeout=20`. Fiecare
funcție serverless deschide propria conexiune; fără limită, la câteva clase
simultane apar erori `too many connections`.

Dacă tot apar la scară mai mare: mută baza pe Neon (are pooler inclus) sau
pune PgBouncer în fața Railway.

---

## Incident, 29 iulie 2026: serviciul vechi de pe Railway

**Simptom.** Notificări de crash de la Vercel și Railway. Site-ul funcționa
normal, dar deploy-urile noi eșuau cu `Error: P3009`.

**Cauză.** Proiectul Railway `zestpad-backend` are două servicii: `Postgres`
și `zestpad-backend` (aplicația NestJS veche). După consolidarea în Next.js,
serviciul NestJS a rămas pornit. Comanda lui de start era:

```
npx prisma migrate deploy && node dist/main.js
```

La fiecare restart încerca să aplice vechea lui migrare
`20260109142419_add_background_to_topic` peste schema nouă. Eșua, dar lăsa în
`_prisma_migrations` o înregistrare de migrare eșuată. Prisma refuză să aplice
orice migrare nouă cât timp există una eșuată — deci build-urile Vercel se
blocau, la nesfârșit.

Două servicii se băteau pe aceeași bază de date: exact problema pe care
consolidarea trebuia s-o elimine.

**Rezolvare.**

1. Oprit serviciul vechi (`railway down --service zestpad-backend`).
2. Șters înregistrarea străină din `_prisma_migrations`.
3. Redeploy.

Ordinea contează: dacă ștergi înregistrarea înainte de a opri serviciul, o
pune la loc în câteva secunde.

**De ce nu se mai poate repeta.** Repo-ul `zestpad-backend` e arhivat, deci nu
mai poate declanșa deploy-uri automate. Serviciul Railway nu mai are deployment
activ. Dacă totuși cineva îl repornește manual, problema reapare — în acel caz,
oprește-l din nou și rulează:

```bash
node fix-migrations.mjs          # arata starea
node fix-migrations.mjs --fix    # sterge inregistrarile straine
```

**Ce merită făcut la un moment dat.** Mută baza de date într-un proiect Railway
separat, ca să nu mai stea lângă un serviciu de aplicație dezafectat. Sau mut-o
pe Neon, care are pooler inclus și rezolvă și problema de conexiuni.
