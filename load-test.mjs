/**
 * Simulare de clasa reala: 1 profesor + N elevi, ora de predare live.
 *
 * Cauta patru lucruri care nu apar la testele functionale:
 *  1. epuizarea conexiunilor la baza (connection_limit=1 per instanta)
 *  2. curse la crearea lucrarilor (upsert simultan pentru acelasi elev)
 *  3. comportamentul sub interogare deasa de la multi elevi deodata
 *  4. scrieri concurente cu desene de dimensiune realista
 *
 * Curata dupa el: sterge clasa de proba si conturile create.
 */
const BASE = process.env.BASE || 'https://edu.kos-solutions.ro';
const N = Number(process.env.STUDENTS || 30);
const RUN = Date.now().toString(36);
const PASS = 'incarcare-test-2026';

const log = (...a) => console.log(...a);
const stats = { req: 0, err: 0, byCode: {}, lat: [] };

function record(status, ms) {
  stats.req++;
  stats.byCode[status] = (stats.byCode[status] || 0) + 1;
  stats.lat.push(ms);
  if (status >= 400) stats.err++;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))]);
}

function client(label = '') {
  let cookie = '';
  return {
    label,
    async call(method, path, body) {
      const t0 = Date.now();
      try {
        const res = await fetch(BASE + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
          redirect: 'manual',
        });
        const sc = res.headers.get('set-cookie');
        if (sc) cookie = sc.split(';')[0];
        const text = await res.text();
        const ms = Date.now() - t0;
        record(res.status, ms);
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text.slice(0, 160) }; }
        return { status: res.status, data, ms };
      } catch (e) {
        const ms = Date.now() - t0;
        record(0, ms);
        return { status: 0, data: { error: String(e.message).slice(0, 120) }, ms };
      }
    },
  };
}

/** Desen de dimensiune realista: o pagina scrisa de mana are sute de trasee. */
function page(strokeCount, seed = 1) {
  const strokes = [];
  for (let i = 0; i < strokeCount; i++) {
    const pts = [];
    const n = 12 + ((seed * i) % 20);
    for (let j = 0; j < n; j++) {
      pts.push([100 + ((i * 7 + j * 13) % 900), 150 + ((i * 23 + j * 5) % 1400), 0.3 + ((j % 7) / 10)]);
    }
    strokes.push({ id: `${seed}-${i}`, color: '#1c1917', size: 3, points: pts });
  }
  return JSON.stringify({ v: 1, width: 1240, height: 1754, strokes });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- setup
log(`\n=== Pregatire: 1 profesor + ${N} elevi ===`);
const teacher = client('prof');
let r = await teacher.call('POST', '/api/auth/register', {
  name: 'Prof Incarcare', email: `lt-prof-${RUN}@test.local`, password: PASS, role: 'TEACHER',
});
if (r.status !== 201) { log('Nu am putut crea profesorul:', r.status, JSON.stringify(r.data)); process.exit(1); }

r = await teacher.call('POST', '/api/classes', { name: `__incarcare ${RUN}` });
const classId = r.data.class.id;
const classCode = r.data.class.code;
log(`clasa ${classCode} creata`);

r = await teacher.call('POST', '/api/topics', { classId, title: 'Capitol test', background: 'MATH' });
const topicId = r.data.topic.id;

// creare elevi in paralel, in valuri de 10 ca sa nu inundam
const students = [];
for (let batch = 0; batch < Math.ceil(N / 10); batch++) {
  const group = [];
  for (let i = batch * 10; i < Math.min((batch + 1) * 10, N); i++) {
    const c = client(`elev${i}`);
    group.push(
      c.call('POST', '/api/auth/register', {
        name: `Elev ${i}`, email: `lt-s${i}-${RUN}@test.local`, password: PASS, role: 'STUDENT',
      }).then((res) => { if (res.status === 201) students.push(c); return res; })
    );
  }
  await Promise.all(group);
}
log(`${students.length}/${N} elevi creati`);

// ---------------------------------------------- FAZA 1: inscriere simultana
log(`\n=== Faza 1: ${students.length} elevi se inscriu in aceeasi secunda ===`);
let t0 = Date.now();
let res = await Promise.all(students.map((s) => s.call('POST', '/api/classes/join', { code: classCode })));
let bad = res.filter((x) => x.status !== 201);
log(`  ${res.length - bad.length}/${res.length} reusite in ${Date.now() - t0} ms`);
if (bad.length) log(`  ESUATE: ${bad.map((b) => b.status).join(', ')} — ${JSON.stringify(bad[0].data).slice(0, 160)}`);

// ---------------------------------------------- FAZA 2: predare live
log('\n=== Faza 2: predare live, toti elevii interogheaza deodata ===');
r = await teacher.call('POST', '/api/lessons', { topicId, title: 'Lectie incarcare', type: 'THEORY' });
const lessonId = r.data.lesson.id;
await teacher.call('POST', `/api/lessons/${lessonId}/live`, { live: true });

let pollErrors = 0, polls = 0;
const pollLat = [];
let teaching = true;

// profesorul scrie tot mai mult, ca la o ora reala
const writer = (async () => {
  for (let round = 1; round <= 8 && teaching; round++) {
    const t = Date.now();
    const rr = await teacher.call('PATCH', `/api/lessons/${lessonId}/content`, { content: page(round * 25, round) });
    if (rr.status !== 200) log(`  scriere profesor esuata: ${rr.status}`);
    else if (round % 4 === 0) log(`  profesorul a scris ${round * 25} trasee (${Math.round(JSON.stringify(page(round * 25, round)).length / 1024)} KB) in ${Date.now() - t} ms`);
    await sleep(2000);
  }
})();

// fiecare elev interogheaza la 1,5s, exact ca aplicatia
const pollers = students.map(async (s) => {
  while (teaching) {
    const rr = await s.call('GET', `/api/lessons/${lessonId}/version`);
    polls++;
    pollLat.push(rr.ms);
    if (rr.status !== 200) pollErrors++;
    await sleep(1500);
  }
});

await writer;
teaching = false;
await Promise.all(pollers);
log(`  ${polls} interogari, ${pollErrors} esuate`);
log(`  latenta interogare: mediana ${pct(pollLat, 50)} ms, p95 ${pct(pollLat, 95)} ms, max ${Math.max(...pollLat)} ms`);

// ---------------------------------------------- FAZA 3: descarcare simultana
log('\n=== Faza 3: toti elevii descarca lectia in aceeasi clipa ===');
t0 = Date.now();
res = await Promise.all(students.map((s) => s.call('GET', `/api/lessons/${lessonId}`)));
bad = res.filter((x) => x.status !== 200);
log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms`);
if (bad.length) log(`  ESUATE: ${JSON.stringify(bad[0].data).slice(0, 200)}`);

// ---------------------------------------------- FAZA 4: notite concurente
log('\n=== Faza 4: toti elevii scriu notite simultan ===');
t0 = Date.now();
res = await Promise.all(students.map((s, i) => s.call('PATCH', `/api/lessons/${lessonId}/notes`, { content: page(60, i + 1) })));
bad = res.filter((x) => x.status !== 200);
log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms`);
if (bad.length) log(`  ESUATE: ${bad.map((b) => b.status).join(', ')} — ${JSON.stringify(bad[0].data).slice(0, 200)}`);

// ---------------------------------------------- FAZA 5: cursa la upsert
log('\n=== Faza 5: tema publicata, toti o deschid deodata (cursa la upsert) ===');
r = await teacher.call('POST', '/api/lessons', { topicId, title: 'Tema incarcare', type: 'HOMEWORK' });
const hwId = r.data.lesson.id;
await teacher.call('PATCH', `/api/lessons/${hwId}`, { published: true });

// fiecare elev deschide tema de doua ori in paralel: exact scenariul de cursa
t0 = Date.now();
res = await Promise.all(students.flatMap((s) => [
  s.call('GET', `/api/lessons/${hwId}`),
  s.call('GET', `/api/lessons/${hwId}`),
]));
bad = res.filter((x) => x.status !== 200);
log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms`);
if (bad.length) {
  log(`  ESUATE: ${[...new Set(bad.map((b) => b.status))].join(', ')}`);
  log(`  primul mesaj: ${JSON.stringify(bad[0].data).slice(0, 250)}`);
}

// verificam sa nu se fi creat lucrari duplicate
r = await teacher.call('GET', `/api/lessons/${hwId}/submissions`);
const subs = r.data.submissions ?? [];
const uniq = new Set(subs.map((s) => s.student.id));
log(`  lucrari create: ${subs.length}, elevi unici: ${uniq.size} ${subs.length === uniq.size ? '(fara duplicate)' : '(DUPLICATE!)'}`);

// ---------------------------------------------- FAZA 6: predare simultana
log('\n=== Faza 6: toti predau tema in aceeasi secunda ===');
const subIds = [];
for (const s of students) {
  const rr = await s.call('GET', `/api/lessons/${hwId}`);
  if (rr.data.mySubmission?.id) subIds.push({ c: s, id: rr.data.mySubmission.id });
}
t0 = Date.now();
res = await Promise.all(subIds.map(({ c, id }, i) =>
  c.call('POST', `/api/submissions/${id}/submit`, { content: page(80, i + 1) })));
bad = res.filter((x) => x.status !== 200);
log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms`);
if (bad.length) log(`  ESUATE: ${bad.map((b) => b.status).join(', ')} — ${JSON.stringify(bad[0].data).slice(0, 200)}`);

// ---------------------------------------------- FAZA 7: catalogul profesorului
log('\n=== Faza 7: profesorul deschide catalogul cu toate lucrarile ===');
t0 = Date.now();
r = await teacher.call('GET', `/api/lessons/${hwId}/submissions`);
log(`  ${r.data.submissions?.length ?? 0} lucrari in ${r.ms} ms (status ${r.status})`);

// ---------------------------------------------- rezumat
log('\n' + '='.repeat(58));
log(`Total cereri: ${stats.req}   erori: ${stats.err} (${((stats.err / stats.req) * 100).toFixed(2)}%)`);
log(`Coduri: ${Object.entries(stats.byCode).map(([k, v]) => `${k}:${v}`).join('  ')}`);
log(`Latenta globala: mediana ${pct(stats.lat, 50)} ms, p95 ${pct(stats.lat, 95)} ms, p99 ${pct(stats.lat, 99)} ms`);
log('='.repeat(58));

// ---------------------------------------------- curatare
log('\nCuratare...');
await teacher.call('DELETE', `/api/classes/${classId}`);
log('clasa arhivata. Conturile de test raman (au prefixul lt- si domeniul test.local).');
log(`RULARE=${RUN}`);
