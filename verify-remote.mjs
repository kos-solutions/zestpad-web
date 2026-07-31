/**
 * Scenariul copilului bolnav acasa.
 *
 * Verifica trei lucruri pe care testele de pana acum nu le acopereau:
 *  1. elevul se conecteaza LA MIJLOCUL orei — trebuie sa primeasca tot ce s-a
 *     scris pana atunci, nu doar ce urmeaza
 *  2. elevul pierde conexiunea si revine dupa cateva minute — trebuie sa
 *     recupereze exact ce a pierdut, fara sa reincarce toata lectia
 *  3. elevul de acasa isi ia notitele lui, care raman ale lui
 */
const BASE = 'https://edu.kos-solutions.ro';
const RUN = Date.now().toString(36);
const PASS = 'incarcare-test-2026';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { if (c) { pass++; console.log(`  OK   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${x}`); } };

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await res.text();
    let d = {}; try { d = text ? JSON.parse(text) : {}; } catch { d = {}; }
    return { status: res.status, data: d, bytes: text.length };
  };
}

function build(total, tag = 's') {
  const strokes = [];
  for (let i = 0; i < total; i++) {
    const pts = [];
    for (let j = 0; j < 18; j++) pts.push([100 + ((i * 7 + j * 13) % 900), 150 + ((i * 23 + j * 5) % 1400), 0.5]);
    strokes.push({ id: `${tag}-${i}`, color: '#1c1917', size: 3, points: pts });
  }
  return JSON.stringify({ v: 1, width: 1240, height: 1754, strokes });
}

// --- pregatire: profesorul incepe ora, elevul e inscris dar nu e conectat
const teacher = client();
let r = await teacher('POST', '/api/auth/register', {
  name: 'Prof Distanta', email: `rm-p-${RUN}@test.local`, password: PASS, role: 'TEACHER',
});
if (r.status !== 201) { console.log('setup esuat', r.status); process.exit(1); }
r = await teacher('POST', '/api/classes', { name: `__distanta ${RUN}` });
const classId = r.data.class.id, code = r.data.class.code;
r = await teacher('POST', '/api/topics', { classId, title: 'Cap', background: 'MATH' });
r = await teacher('POST', '/api/lessons', { topicId: r.data.topic.id, title: 'Ora de azi', type: 'THEORY' });
const lessonId = r.data.lesson.id;

const acasa = client();
await acasa('POST', '/api/auth/register', {
  name: 'Copil Bolnav', email: `rm-s-${RUN}@test.local`, password: PASS, role: 'STUDENT',
});
await acasa('POST', '/api/classes/join', { code });

console.log('\n=== 1. Ora incepe. Copilul e acasa si NU s-a conectat inca ===');
await teacher('POST', `/api/lessons/${lessonId}/live`, { live: true });
// profesorul preda 20 de minute inainte ca el sa deschida tableta
await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content: build(120) });
console.log('  profesorul a scris deja 120 de trasee');

console.log('\n=== 2. Copilul deschide lectia LA MIJLOCUL orei ===');
r = await acasa('GET', `/api/lessons/${lessonId}/version`);
ok('vede ca se preda in direct', r.status === 200 && r.data.live === true);
ok('stie cate trasee exista', r.data.n === 120, `n=${r.data.n}`);

// un client nou porneste de la zero
r = await acasa('GET', `/api/lessons/${lessonId}/delta?since=0`);
ok('primeste TOT ce s-a scris pana acum', r.data.strokes?.length === 120, `primit ${r.data.strokes?.length}`);
console.log(`       a descarcat ${Math.round(r.bytes / 1024)} KB ca sa prinda din urma`);
let have = r.data.total;

console.log('\n=== 3. Ora continua, copilul urmareste ===');
await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content: build(135) });
r = await acasa('GET', `/api/lessons/${lessonId}/delta?since=${have}`);
ok('primeste doar traseele noi', r.data.strokes?.length === 15, `primit ${r.data.strokes?.length}`);
console.log(`       doar ${Math.round(r.bytes / 1024)} KB pentru actualizare`);
have = r.data.total;

console.log('\n=== 4. Ii pica netul acasa. Profesorul scrie mai departe ===');
for (const n of [150, 170, 195, 220]) {
  await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content: build(n) });
}
console.log('  profesorul a ajuns la 220 de trasee cat timp el era deconectat');

console.log('\n=== 5. Netul revine. Recupereaza ce a pierdut ===');
r = await acasa('GET', `/api/lessons/${lessonId}/delta?since=${have}`);
ok('recupereaza exact ce a pierdut', r.data.strokes?.length === 85, `primit ${r.data.strokes?.length}`);
ok('nu i se cere sa reincarce tot', r.data.reset === false);
console.log(`       ${Math.round(r.bytes / 1024)} KB pentru 85 de trasee pierdute (lectia intreaga: ${Math.round(build(220).length / 1024)} KB)`);
have = r.data.total;

console.log('\n=== 6. Isi ia notitele lui, de acasa ===');
r = await acasa('PATCH', `/api/lessons/${lessonId}/notes`, { content: build(20, 'note') });
ok('poate scrie notite', r.status === 200);
r = await acasa('GET', `/api/lessons/${lessonId}/notes`);
ok('notitele persista', JSON.parse(r.data.content).strokes.length === 20);

r = await teacher('GET', `/api/lessons/${lessonId}/notes`);
ok('profesorul nu vede notitele copilului', r.status === 403);

console.log('\n=== 7. Ora se termina. Lectia ramane accesibila ===');
await teacher('POST', `/api/lessons/${lessonId}/live`, { live: false });
r = await acasa('GET', `/api/lessons/${lessonId}/version`);
ok('predarea s-a oprit', r.data.live === false);
ok('lectia ramane publicata', r.data.published === true);
r = await acasa('GET', `/api/lessons/${lessonId}`);
ok('poate reciti lectia oricand dupa aceea',
  JSON.parse(r.data.lesson.content).strokes.length === 220);

console.log('\n=== Curatare ===');
await teacher('DELETE', `/api/classes/${classId}`);
console.log(`\n${'='.repeat(48)}`);
console.log(`REZULTAT INVATARE LA DISTANTA: ${pass} trecute, ${fail} esuate`);
console.log('='.repeat(48));
process.exit(fail > 0 ? 1 : 0);
