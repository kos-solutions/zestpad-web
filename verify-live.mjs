// Verifica pe productie fluxul de predare live si izolarea notitelor.
// Curata dupa el: lectia creata e stearsa la final.
const BASE = 'https://edu.kos-solutions.ro';
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
    const t = await res.text();
    let d = {};
    try { d = t ? JSON.parse(t) : {}; } catch { d = {}; }
    return { status: res.status, data: d };
  };
}

const drawing = (n) => JSON.stringify({
  v: 1, width: 1240, height: 1754,
  strokes: Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, color: '#1c1917', size: 3,
    points: [[100 + i, 200, 0.4], [160 + i, 250, 0.8], [220 + i, 210, 0.5]],
  })),
});

const teacher = client(), student = client();
await teacher('POST', '/api/auth/login', { email: 'profesor@zestpad.demo', password: 'zestpad123' });
await student('POST', '/api/auth/login', { email: 'elev@zestpad.demo', password: 'zestpad123' });

let r = await teacher('GET', '/api/classes');
const classId = r.data.classes[0].id;
r = await teacher('GET', `/api/classes/${classId}`);
const topicId = r.data.class.topics[0].id;

console.log('=== Predare live ===');
r = await teacher('POST', '/api/lessons', {
  topicId, title: `__verificare live ${Date.now()}`, type: 'THEORY',
});
ok('lectie de proba creata', r.status === 201, JSON.stringify(r.data));
const lessonId = r.data.lesson?.id;

r = await student('GET', `/api/lessons/${lessonId}/version`);
ok('elevul nu vede lectia nepublicata', r.status === 404, `primit ${r.status}`);

r = await teacher('POST', `/api/lessons/${lessonId}/live`, { live: true });
ok('profesorul porneste predarea', r.status === 200 && r.data.live === true);
ok('lectia se publica automat', r.data.published === true);

r = await student('GET', `/api/lessons/${lessonId}/version`);
ok('elevul vede starea live', r.status === 200 && r.data.live === true);
const v1 = r.data.v;

const t0 = Date.now();
await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content: drawing(6) });
r = await student('GET', `/api/lessons/${lessonId}/version`);
ok('versiunea se schimba dupa ce profesorul scrie', r.data.v !== v1);
console.log(`       latenta server: ${Date.now() - t0} ms`);

r = await student('GET', `/api/lessons/${lessonId}`);
ok('elevul primeste continutul', JSON.parse(r.data.lesson.content).strokes.length === 6);

console.log('\n=== Notite private ===');
r = await student('PATCH', `/api/lessons/${lessonId}/notes`, { content: drawing(3) });
ok('elevul isi salveaza notitele', r.status === 200);

r = await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content: drawing(11) });
r = await student('GET', `/api/lessons/${lessonId}/notes`);
ok('notitele nu sunt suprascrise de profesor', JSON.parse(r.data.content).strokes.length === 3);

r = await teacher('GET', `/api/lessons/${lessonId}/notes`);
ok('profesorul nu poate citi notitele', r.status === 403, `primit ${r.status}`);

console.log('\n=== Curatare ===');
r = await teacher('DELETE', `/api/lessons/${lessonId}`);
ok('lectia de proba stearsa', r.status === 200);

console.log(`\n${'='.repeat(46)}`);
console.log(`REZULTAT LIVE: ${pass} trecute, ${fail} esuate`);
console.log('='.repeat(46));
process.exit(fail > 0 ? 1 : 0);
