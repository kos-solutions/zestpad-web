# Teste

## Ce se rulează și când

| Script | Ce face | Când |
|---|---|---|
| `e2e-test.mjs` | 88 de scenarii pe server local (`:3100`) | înainte de fiecare push |
| `verify-prod.mjs` | 19 verificări pe producție | după fiecare deploy |
| `verify-live.mjs` | 11 verificări ale predării live | după modificări la sincronizare |
| `load-test.mjs` | o clasă reală: 30 de elevi, oră live | înainte de un pilot |
| `stress-test.mjs` | 80 de elevi, rafale fără pauze | când schimbi ceva la scară |
| `bandwidth-real.mjs` | cât trafic consumă o oră de predare | după modificări la sincronizare |
| `cleanup-test.mjs` | șterge conturile `@test.local` | după testele de încărcare |

```bash
npm run build && npm start            # apoi, in alt terminal:
node e2e-test.mjs

node verify-prod.mjs                   # pe productie
STUDENTS=30 node load-test.mjs
node cleanup-test.mjs                  # obligatoriu dupa load/stress
```

Testele de încărcare creează conturi reale în baza de producție, cu domeniul
`@test.local`. `cleanup-test.mjs` le șterge pe toate. Rulează-l de fiecare dată,
altfel rămân zeci de conturi în listă.

---

## Rezultate măsurate — 29 iulie 2026

### Clasă normală: 30 de elevi, oră live

599 de cereri, **0 erori**.

| Fază | Rezultat |
|---|---|
| 30 de înscrieri simultane | 30/30 în 1,0 s |
| 342 de verificări în timpul predării | 0 eșuate, mediana 142 ms, p95 313 ms |
| 30 de descărcări simultane | 30/30 în 476 ms |
| 30 de scrieri de notițe simultane | 30/30 în 355 ms |
| 60 de deschideri simultane ale temei | fără lucrări duplicate |
| 30 de predări simultane | 30/30 în 625 ms |

### Test de rupere: 80 de elevi, fără pauze

742 de cereri, **0 erori**. Latența crește sub rafală (mediana 1,3 s,
p99 2,0 s), dar nimic nu cedează.

| Fază | Rezultat |
|---|---|
| 80 de înregistrări simultane | 80/80 în 1,6 s |
| 400 de cereri deodată | 400/400, max 2,0 s |
| Desen de 2,6 MB (8000 de trasee) | acceptat în 678 ms |
| 10 salvări paralele ale aceluiași elev | conținut final coerent, nu amestecat |

Nu s-a atins epuizarea conexiunilor la bază. `connection_limit=1` pe
`DATABASE_URL` își face treaba.

### Trafic: problema găsită și rezolvată

Testul de bandă a scos la iveală o problemă de proiectare pe care testele
funcționale nu o puteau prinde: în timpul predării live, fiecare elev
descărca lecția **întreagă** la fiecare schimbare. Lecția crește pe parcursul
orei, deci fiecare descărcare era tot mai mare.

| | Înainte | După |
|---|---|---|
| Per elev, pe oră | ~417 MB | ~1,6 MB |
| 30 de elevi, o oră | ~12,5 GB | ~49 MB |
| O clasă, pe lună | ~1466 GB | ~5,7 GB |
| 10 clase, pe lună | ~14 TB | ~57 GB |

Vercel Pro include 1 TB pe lună. Înainte, o singură clasă l-ar fi depășit.
Mai important: 417 MB pe oră per tabletă ar fi sufocat wifi-ul oricărei școli.

Rezolvarea: se trimit doar traseele adăugate de la ultima sincronizare
(`/api/lessons/[id]/delta?since=N`). Formatul de stocare permitea asta din
start, dar nu era folosit.

---

## Ce NU a fost testat încă

- **30 de tablete fizice pe același wifi.** Testele rulează de pe o singură
  mașină, prin internet. Comportamentul unei rețele de școală, cu 30 de
  dispozitive pe același punct de acces, e alt lucru.
- **Sesiuni lungi.** Cel mai lung test a durat câteva minute, nu 50.
  Scurgerile de memorie sau de conexiuni apar în timp.
- **Reconectare după întreruperi repetate.** Modul offline e testat pentru
  o singură cădere, nu pentru un wifi care pică de 20 de ori într-o oră.
- **Browsere vechi.** Testat pe Chrome recent. Tabletele ieftine vin uneori
  cu WebView învechit, unde `PointerEvent.getCoalescedEvents` poate lipsi.
