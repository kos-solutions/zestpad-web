/**
 * Simulare fidela a unei ore: profesorul scrie continuu, autosalvarea trimite
 * la ~1,2 s, deci fiecare salvare adauga cateva trasee, nu sute.
 * Masuram exact ce descarca un elev intr-o astfel de secventa.
 */
const BASE = 'https://edu.kos-solutions.ro';
const RUN = Date.now().toString(36);
const PASS = 'incarcare-test-2026';

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

/** Trasee cumulate: fiecare salvare pastreaza tot ce s-a scris pana atunci. */
function build(total) {
  const strokes = [];
  for (let i = 0; i < total; i++) {
    const pts = [];
    for (let j = 0; j < 20; j++) pts.push([100 + ((i * 7 + j * 13) % 900), 150 + ((i * 23 + j * 5) % 1400), 0.5]);
    strokes.push({ id: `s-${i}`, color: '#1c1917', size: 3, points: pts });
  }
  return JSON.stringify({ v: 1, width: 1240, height: 1754, strokes });
}

const teacher = client();
let reg = await teacher('POST', '/api/auth/register', { name: 'Prof Real', email: `br-p-${RUN}@test.local`, password: PASS, role: 'TEACHER' });
if (reg.status !== 201) { console.log('setup esuat:', reg.status, JSON.stringify(reg.data)); process.exit(1); }
let r = await teacher('POST', '/api/classes', { name: `__real ${RUN}` });
const classId = r.data.class.id, code = r.data.class.code;
r = await teacher('POST', '/api/topics', { classId, title: 'R', background: 'WHITE' });
r = await teacher('POST', '/api/lessons', { topicId: r.data.topic.id, title: 'R', type: 'THEORY' });
const lessonId = r.data.lesson.id;
await teacher('POST', `/api/lessons/${lessonId}/live`, { live: true });

const student = client();
await student('POST', '/api/auth/register', { name: 'Elev Real', email: `br-e-${RUN}@test.local`, password: PASS, role: 'STUDENT' });
await student('POST', '/api/classes/join', { code });

// 40 de salvari a cate 3 trasee = ritm realist de scris
const SALVARI = 40, PE_SALVARE = 3;
console.log(`\n=== Ritm realist: ${SALVARI} salvari x ${PE_SALVARE} trasee ===\n`);

let have = 0, deltaBytes = 0, versionBytes = 0, fullEchiv = 0;
for (let k = 1; k <= SALVARI; k++) {
  const total = k * PE_SALVARE;
  await teacher('PATCH', `/api/lessons/${lessonId}/content`, { content: build(total) });
  const v = await student('GET', `/api/lessons/${lessonId}/version`);
  versionBytes += v.bytes;
  const d = await student('GET', `/api/lessons/${lessonId}/delta?since=${have}`);
  have = d.data.total;
  deltaBytes += d.bytes;
  fullEchiv += build(total).length;   // cat ar fi fost cu descarcare completa
  if (k % 10 === 0) console.log(`  dupa ${String(total).padStart(3)} trasee: delta cumulat ${Math.round(deltaBytes / 1024)} KB, complet ar fi fost ${Math.round(fullEchiv / 1024)} KB`);
}

const lectieFinala = build(SALVARI * PE_SALVARE).length;
console.log('\n  ' + '-'.repeat(52));
console.log(`  Lectia finala:                ${Math.round(lectieFinala / 1024)} KB`);
console.log(`  Descarcat de elev (delta):    ${Math.round(deltaBytes / 1024)} KB`);
console.log(`  Verificari de versiune:       ${Math.round(versionBytes / 1024)} KB`);
console.log(`  Ar fi fost fara delta:        ${Math.round(fullEchiv / 1024)} KB`);
console.log(`  Reducere:                     ${Math.round((1 - deltaBytes / fullEchiv) * 100)}%`);

// o ora reala: ~1500 salvari, lectia ajunge la ~1500-2000 trasee
const perSalvare = deltaBytes / SALVARI;
const versPerSalvare = versionBytes / SALVARI;
const oraKB = ((perSalvare + versPerSalvare) * 1500) / 1024;
console.log('\n=== Extrapolare la o ora de 50 min (~1500 verificari) ===');
console.log(`  Per elev pe ora:      ~${Math.round(oraKB / 1024 * 10) / 10} MB   (inainte: ~417 MB)`);
console.log(`  30 elevi, o ora:      ~${Math.round(oraKB * 30 / 1024)} MB   (inainte: ~12500 MB)`);
console.log(`  O clasa pe luna:      ~${(oraKB * 30 * 6 * 20 / 1024 / 1024).toFixed(1)} GB   (inainte: ~1466 GB)`);
console.log(`  10 clase pe luna:     ~${(oraKB * 30 * 6 * 20 * 10 / 1024 / 1024).toFixed(0)} GB`);

await teacher('DELETE', `/api/classes/${classId}`);
console.log('\nclasa arhivata.');
