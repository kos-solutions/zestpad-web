# Deploy — pas cu pas

Ordinea contează. Pasul 2 trebuie făcut **înainte** de push, altfel primul
build cade la migrare.

---

## 1. Pune codul în `zestpad-web`

Codul nou înlocuiește tot conținutul repo-ului. Istoricul commit-urilor rămâne
intact — adăugăm peste, nu rescriem.

```bash
# Clonează repo-ul existent (sau intră în copia ta locală)
git clone https://github.com/kos-solutions/zestpad-web.git
cd zestpad-web

# Ramură de siguranță, ca să te poți întoarce
git checkout -b backup-vite && git push -u origin backup-vite
git checkout main

# Șterge conținutul vechi, păstrând .git
git rm -r --cached . > /dev/null
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

# Copiază aici tot conținutul folderului zestpad-v2, apoi:
git add -A
git commit -m "Rescriere ca aplicatie Next.js: flux teme, rol parinte, canvas cu presiune, mod offline"
```

**Nu da `push` încă.** Fă întâi pasul 2.

---

## 2. Variabile de mediu în Vercel

Proiect `zestpad-web` → Settings → Environment Variables.
Bifează **toate** cele trei medii (Production, Preview, Development).

| Nume | Valoare |
|---|---|
| `DATABASE_URL` | Connection string-ul public din Railway (Postgres → Connect → Public Network) |
| `JWT_SECRET` | `nnY/6rSLCZJMdmH8NY2g4DrXRUFa2ZFfS9onaDhbSul2lrK0pobO6gyMO6Oxd3WU` |

Secretul de mai sus e generat pentru tine. Dacă preferi altul:
`openssl rand -base64 48`

Folosește URL-ul **public** din Railway, nu cel intern (`.railway.internal`) —
Vercel rulează în afara rețelei Railway și nu îl poate rezolva.

---

## 3. Golește baza de date o singură dată

Schema veche e incompatibilă (ID-uri `Int` → `String`, patru tabele noi).
Rulează local, o singură dată:

```bash
export DATABASE_URL="postgresql://...din-railway..."
npx prisma migrate reset --force --skip-seed
```

Confirmă că a mers:

```bash
npx prisma migrate status     # trebuie: "Database schema is up to date!"
```

De aici încolo migrările se aplică singure la fiecare deploy.

Opțional, date demo pentru testat imediat:

```bash
npm install && npx prisma db seed
```

---

## 4. Push → deploy automat

```bash
git push origin main
```

Vercel detectează push-ul și pornește build-ul. `vercel.json` forțează
framework-ul pe `nextjs` (proiectul era configurat pe `vite`) și rulează
migrările înainte de build.

Urmărește build-ul în Vercel → Deployments. Durează 2-3 minute.

---

## 5. Verifică

Deschide `https://edu.kos-solutions.ro` și, dacă ai rulat seed-ul:

| Rol | Email | Parolă |
|---|---|---|
| Profesor | `profesor@zestpad.demo` | `zestpad123` |
| Elev | `elev@zestpad.demo` | `zestpad123` |
| Părinte | `parinte@zestpad.demo` | `zestpad123` |

Testul care contează: deschide `/tema/...` de pe o tabletă cu stylus și scrie.

---

## 6. Arhivează `zestpad-backend`

```bash
cd ../zestpad-backend
# înlocuiește README.md cu cel din folderul zestpad-backend-archive
git add -A && git commit -m "Arhivat: codul s-a mutat in zestpad-web" && git push
```

Apoi pe GitHub: Settings → jos de tot → **Archive this repository**.

---

## Dacă build-ul cade

| Eroare în log | Cauză | Rezolvare |
|---|---|---|
| `Can't reach database server` | URL intern Railway, sau baza suspendată | Folosește URL-ul public; verifică că serviciul e activ |
| `P3005: database schema is not empty` | Pasul 3 nu a fost făcut | Rulează `prisma migrate reset --force` |
| `JWT_SECRET lipseste sau e prea scurt` | Variabila nu e setată pe mediul respectiv | Adaug-o pe toate cele trei medii, apoi redeploy |
| `The migrations recorded in the database diverge` | Baza are urme din migrarea Prisma veche | `prisma migrate reset --force` |
| Build rulează Vite, nu Next | `vercel.json` nu a ajuns în repo | Verifică `git status`, trebuie să fie în root |

Log-urile de build sunt în Vercel → Deployments → click pe deploy → Building.

---

## De urmărit după lansare: conexiunile la baza de date

Vercel rulează fiecare rută ca funcție serverless. Fiecare instanță deschide
propria conexiune la Postgres. La 30 de elevi care salvează simultan, poți
depăși limita de conexiuni a Railway și primești erori
`too many connections` sau `Timed out fetching a new connection`.

Nu e o problemă la un pilot de o clasă. Devine una la 3-4 clase simultane.

Când se întâmplă, ai trei variante, în ordinea efortului:

1. **Limitează pool-ul per instanță** — adaugă la `DATABASE_URL`:
   `?connection_limit=1&pool_timeout=20`
   Cea mai rapidă soluție, zero cost.

2. **Pune un pooler în față** — PgBouncer în fața Railway, sau mută pe Neon
   (are pooler inclus, endpoint separat `-pooler`).

3. **Prisma Accelerate** — pooler gestionat de Prisma, plătit.

Recomandarea mea: pornește cu varianta 1 din prima zi. Nu costă nimic și
elimină problema până la scara la care oricum vei muta baza.
