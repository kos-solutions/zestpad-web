/**
 * Test de rupere. Cauta limita, nu confirmarea.
 *  A. rafala de cereri simultane, fara pauze (epuizare conexiuni)
 *  B. desene foarte mari (limita de payload)
 *  C. multi elevi care scriu pe acelasi obiect in acelasi timp
 *  D. interogare foarte deasa, ca un intreg an de studiu deodata
 */
const BASE = process.env.BASE || 'https://edu.kos-solutions.ro';
const RUN = Date.now().toString(36);
const PASS = 'incarcare-test-2026';

const codes = {};
const lat = [];
function rec(s, ms) { codes[s] = (codes[s] || 0) + 1; lat.push(ms); }
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))]); };

function client() {
  let cookie = '';
  return async (method, path, body) => {
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
      rec(res.status, ms);
      let d = {}; try { d = text ? JSON.parse(text) : {}; } catch { d = { _raw: text.slice(0, 200) }; }
      return { status: res.status, data: d, ms };
    } catch (e) {
      const ms = Date.now() - t0;
      rec(0, ms);
      return { status: 0, data: { error: String(e.message).slice(0, 150) }, ms };
    }
  };
}

function page(n, seed = 1) {
  const strokes = [];
  for (let i = 0; i < n; i++) {
    const pts = [];
    for (let j = 0; j < 20; j++) pts.push([100 + ((i * 7 + j * 13) % 900), 150 + ((i * 23 + j * 5) % 1400), 0.5]);
    strokes.push({ id: `${seed}-${i}`, color: '#1c1917', size: 3, points: pts });
  }
  return JSON.stringify({ v: 1, width: 1240, height: 1754, strokes });
}
const kb = (s) => Math.round(s.length / 1024);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const N = Number(process.env.STUDENTS || 80);
console.log(`\n### Test de rupere: ${N} elevi, fara menajamente ###`);

const teacher = client();
let r = await teacher('POST', '/api/auth/register', {
  name: 'Prof Stres', email: `st-prof-${RUN}@test.local`, password: PASS, role: 'TEACHER',
});
if (r.status !== 201) { console.log('setup esuat', r.status, JSON.stringify(r.data)); process.exit(1); }
r = await teacher('POST', '/api/classes', { name: `__stres ${RUN}` });
const classId = r.data.class.id, code = r.data.class.code;
r = await teacher('POST', '/api/topics', { classId, title: 'Cap stres', background: 'WHITE' });
const topicId = r.data.topic.id;

// --- creare elevi in rafale mari, deodata
console.log(`\n=== A. ${N} inregistrari simultane (bcrypt e costisitor intentionat) ===`);
let t0 = Date.now();
const regs = await Promise.all(Array.from({ length: N }, (_, i) => {
  const c = client();
  return c('POST', '/api/auth/register', {
    name: `Stres ${i}`, email: `st-s${i}-${RUN}@test.local`, password: PASS, role: 'STUDENT',
  }).then((res) => ({ c, res }));
}));
const students = regs.filter((x) => x.res.status === 201).map((x) => x.c);
const regBad = regs.filter((x) => x.res.status !== 201);
console.log(`  ${students.length}/${N} in ${Date.now() - t0} ms, p95 ${pct(regs.map((x) => x.res.ms), 95)} ms`);
if (regBad.length) console.log(`  esuate: ${[...new Set(regBad.map((b) => b.res.status))].join(',')} — ${JSON.stringify(regBad[0].res.data).slice(0, 200)}`);

console.log(`\n=== B. ${students.length} inscrieri simultane ===`);
t0 = Date.now();
let res = await Promise.all(students.map((s) => s('POST', '/api/classes/join', { code })));
let bad = res.filter((x) => x.status !== 201);
console.log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms`);
if (bad.length) console.log(`  esuate: ${[...new Set(bad.map((b) => b.status))].join(',')} — ${JSON.stringify(bad[0].data).slice(0, 200)}`);

r = await teacher('POST', '/api/lessons', { topicId, title: 'Stres', type: 'THEORY' });
const lessonId = r.data.lesson.id;
await teacher('POST', `/api/lessons/${lessonId}/live`, { live: true });

// --- desene tot mai mari, pana la limita
console.log('\n=== C. Desene tot mai mari, pana unde accepta ===');
for (const n of [200, 500, 1000, 2000, 4000, 8000]) {
  const content = page(n, 9);
  const rr = await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content });
  console.log(`  ${String(n).padStart(4)} trasee, ${String(kb(content)).padStart(5)} KB -> ${rr.status} in ${rr.ms} ms`);
  if (rr.status !== 200) { console.log(`     mesaj: ${JSON.stringify(rr.data).slice(0, 180)}`); break; }
}

// --- rafala fara pauze
console.log(`\n=== D. Rafala: ${students.length} elevi interogheaza de 5 ori, fara pauza ===`);
t0 = Date.now();
res = await Promise.all(students.flatMap((s) => Array.from({ length: 5 }, () => s('GET', `/api/lessons/${lessonId}/version`))));
bad = res.filter((x) => x.status !== 200);
console.log(`  ${res.length} cereri in ${Date.now() - t0} ms — ${res.length - bad.length} ok, ${bad.length} esuate`);
console.log(`  latenta: mediana ${pct(res.map((x) => x.ms), 50)} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms, max ${Math.max(...res.map((x) => x.ms))} ms`);
if (bad.length) console.log(`  coduri esec: ${[...new Set(bad.map((b) => b.status))].join(',')} — ${JSON.stringify(bad[0].data).slice(0, 200)}`);

// --- descarcare simultana a unei lectii mari
console.log(`\n=== E. ${students.length} elevi descarca simultan lectia mare ===`);
t0 = Date.now();
res = await Promise.all(students.map((s) => s('GET', `/api/lessons/${lessonId}`)));
bad = res.filter((x) => x.status !== 200);
console.log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms`);
if (bad.length) console.log(`  esuate: ${[...new Set(bad.map((b) => b.status))].join(',')} — ${JSON.stringify(bad[0].data).slice(0, 200)}`);

// --- scrieri concurente masive
console.log(`\n=== F. ${students.length} elevi scriu notite mari simultan ===`);
t0 = Date.now();
res = await Promise.all(students.map((s, i) => s('PATCH', `/api/lessons/${lessonId}/notes`, { content: page(300, i + 1) })));
bad = res.filter((x) => x.status !== 200);
console.log(`  ${res.length - bad.length}/${res.length} in ${Date.now() - t0} ms, p95 ${pct(res.map((x) => x.ms), 95)} ms`);
if (bad.length) console.log(`  esuate: ${[...new Set(bad.map((b) => b.status))].join(',')} — ${JSON.stringify(bad[0].data).slice(0, 250)}`);

// --- acelasi elev scrie de mai multe ori in paralel (ultima scriere castiga?)
console.log('\n=== G. Acelasi elev, 10 salvari in paralel (ultima castiga?) ===');
const s0 = students[0];
res = await Promise.all(Array.from({ length: 10 }, (_, i) => s0('PATCH', `/api/lessons/${lessonId}/notes`, { content: page(10, 100 + i) })));
bad = res.filter((x) => x.status !== 200);
console.log(`  ${res.length - bad.length}/${res.length} reusite`);
r = await s0('GET', `/api/lessons/${lessonId}/notes`);
console.log(`  continut final: ${JSON.parse(r.data.content).strokes.length} trasee (coerent, nu amestecat)`);

console.log('\n' + '='.repeat(58));
const total = Object.values(codes).reduce((a, b) => a + b, 0);
const errs = Object.entries(codes).filter(([k]) => Number(k) === 0 || Number(k) >= 400).reduce((a, [, v]) => a + v, 0);
console.log(`Total: ${total} cereri, ${errs} erori (${((errs / total) * 100).toFixed(2)}%)`);
console.log(`Coduri: ${Object.entries(codes).sort().map(([k, v]) => `${k === '0' ? 'retea' : k}:${v}`).join('  ')}`);
console.log(`Latenta: mediana ${pct(lat, 50)} ms, p95 ${pct(lat, 95)} ms, p99 ${pct(lat, 99)} ms, max ${Math.max(...lat)} ms`);
console.log('='.repeat(58));

await teacher('DELETE', `/api/classes/${classId}`);
console.log(`\nclasa arhivata. RULARE=${RUN}`);
