/**
 * Test end-to-end pe HTTP real: profesor -> clasa -> capitol -> tema
 * -> elev se inscrie, scrie, preda -> profesor corecteaza -> parinte vede.
 * Verifica si ca autorizarea blocheaza accesul neautorizat.
 */
const BASE = 'http://127.0.0.1:3100';
let pass = 0, fail = 0;

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  \x1b[32mOK\x1b[0m  ${name}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${name} ${extra}`); }
}

function makeClient() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const setC = res.headers.get('set-cookie');
    if (setC) cookie = setC.split(';')[0];
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text.slice(0, 200) }; }
    return { status: res.status, data };
  };
}

function drawing(n, color = '#1a1a1a') {
  return JSON.stringify({
    v: 1, width: 1240, height: 1754,
    strokes: Array.from({ length: n }, (_, i) => ({
      id: `s${i}`, color, size: 3,
      points: [[100 + i, 200, 0.4], [140 + i, 240, 0.7], [180 + i, 210, 0.5]],
    })),
  });
}

const rnd = Math.random().toString(36).slice(2, 8);
const teacher = makeClient(), student = makeClient(), student2 = makeClient(), parent = makeClient();

console.log('\n=== 1. Inregistrare si autentificare ===');
let r = await teacher('POST', '/api/auth/register', {
  name: 'Prof. Ionescu', email: `prof.${rnd}@test.ro`, password: 'parola1234', role: 'TEACHER',
});
check('profesor inregistrat', r.status === 201, JSON.stringify(r.data));

r = await student('POST', '/api/auth/register', {
  name: 'Andrei Elev', email: `elev.${rnd}@test.ro`, password: 'parola1234', role: 'STUDENT',
});
check('elev inregistrat', r.status === 201);
check('elev primeste cod pentru parinte', typeof r.data.user?.linkCode === 'string' && r.data.user.linkCode.length === 8);
const childLinkCode = r.data.user.linkCode;

r = await student2('POST', '/api/auth/register', {
  name: 'Maria Eleva', email: `elev2.${rnd}@test.ro`, password: 'parola1234', role: 'STUDENT',
});
check('al doilea elev inregistrat', r.status === 201);

r = await parent('POST', '/api/auth/register', {
  name: 'Dna Popescu', email: `parinte.${rnd}@test.ro`, password: 'parola1234', role: 'PARENT',
});
check('parinte inregistrat', r.status === 201);

r = await teacher('POST', '/api/auth/register', {
  name: 'Impostor', email: `prof.${rnd}@test.ro`, password: 'parola1234', role: 'TEACHER',
});
check('email duplicat respins', r.status === 409);

r = await makeClient()('POST', '/api/auth/login', { email: `prof.${rnd}@test.ro`, password: 'gresit' });
check('parola gresita respinsa', r.status === 401);

r = await makeClient()('POST', '/api/auth/register', {
  name: 'Nume Valid', email: `scurt.${rnd}@test.ro`, password: '123', role: 'STUDENT',
});
check('parola prea scurta respinsa', r.status === 400);

console.log('\n=== 2. Profesorul creeaza structura ===');
r = await teacher('POST', '/api/classes', { name: 'Matematica — a 5-a B' });
check('clasa creata', r.status === 201, JSON.stringify(r.data));
const classId = r.data.class?.id;
const classCode = r.data.class?.code;
check('cod clasa de 6 caractere', classCode?.length === 6, classCode);

r = await teacher('POST', '/api/topics', { classId, title: 'Cap. 1 — Ecuatii', background: 'MATH' });
check('capitol creat cu liniatura matematica', r.status === 201 && r.data.topic?.background === 'MATH');
const topicId = r.data.topic?.id;

r = await teacher('POST', '/api/lessons', { topicId, title: 'Ecuatii de gradul I', type: 'THEORY' });
check('lectie de teorie creata', r.status === 201);
const theoryId = r.data.lesson?.id;

r = await teacher('POST', '/api/lessons', {
  topicId, title: 'Tema 1 — exercitii', type: 'HOMEWORK',
  dueAt: new Date(Date.now() + 7 * 864e5).toISOString(),
});
check('tema creata', r.status === 201);
const hwId = r.data.lesson?.id;

r = await teacher('PATCH', `/api/lessons/${theoryId}/content`, { content: drawing(5) });
check('profesorul salveaza scrisul pe lectie', r.status === 200);

console.log('\n=== 3. Autorizare: ce NU trebuie sa mearga ===');
r = await student('POST', '/api/topics', { classId, title: 'Hack', background: 'WHITE' });
check('elevul NU poate crea capitole', r.status === 403, `primit ${r.status}`);

r = await student('GET', `/api/classes/${classId}`);
check('elev neinscris NU vede clasa', r.status === 403, `primit ${r.status}`);

r = await student('GET', `/api/lessons/${theoryId}`);
check('elev neinscris NU vede lectia', r.status === 403 || r.status === 404, `primit ${r.status}`);

r = await makeClient()('GET', '/api/classes');
check('nelogat respins cu 401', r.status === 401);

r = await parent('POST', '/api/classes', { name: 'Clasa parintelui' });
check('parintele NU poate crea clase', r.status === 403);

console.log('\n=== 4. Elevii se inscriu ===');
r = await student('POST', '/api/classes/join', { code: 'ZZZZZZ' });
check('cod invalid respins', r.status === 404);

r = await student('POST', '/api/classes/join', { code: classCode });
check('elev 1 inscris', r.status === 201, JSON.stringify(r.data));

r = await student('POST', '/api/classes/join', { code: classCode });
check('inscriere dubla respinsa', r.status === 409);

r = await student2('POST', '/api/classes/join', { code: classCode });
check('elev 2 inscris', r.status === 201);

r = await student('GET', `/api/classes/${classId}`);
check('elev inscris vede clasa', r.status === 200);
check('elevul NU primeste codul clasei', r.data.class?.code === undefined);

console.log('\n=== 5. Vizibilitatea lectiilor nepublicate ===');
r = await student('GET', `/api/topics/${topicId}`);
check('elevul nu vede lectii nepublicate', r.status === 200 && r.data.topic?.lessons?.length === 0,
  `vede ${r.data.topic?.lessons?.length}`);

r = await teacher('GET', `/api/topics/${topicId}`);
check('profesorul vede toate lectiile', r.status === 200 && r.data.topic?.lessons?.length === 2);

r = await teacher('PATCH', `/api/lessons/${theoryId}`, { published: true });
check('lectie publicata', r.status === 200);
r = await teacher('PATCH', `/api/lessons/${hwId}`, { published: true });
check('tema publicata', r.status === 200);

r = await teacher('GET', `/api/lessons/${hwId}/submissions`);
check('publicarea temei genereaza lucrari pentru ambii elevi', r.data.submissions?.length === 2,
  `generat ${r.data.submissions?.length}`);

r = await student('GET', `/api/topics/${topicId}`);
check('elevul vede acum lectiile publicate', r.data.topic?.lessons?.length === 2);

console.log('\n=== 6. Elevul rezolva si preda tema ===');
r = await student('GET', `/api/lessons/${hwId}`);
check('elevul primeste propria lucrare', r.status === 200 && !!r.data.mySubmission?.id);
const subId = r.data.mySubmission.id;
check('lucrarea porneste neinceputa', r.data.mySubmission.status === 'NOT_STARTED');

r = await student('PATCH', `/api/submissions/${subId}`, { content: drawing(12) });
check('elevul isi salveaza ciorna', r.status === 200);

r = await student('GET', `/api/submissions/${subId}`);
check('ciorna salvata, status DRAFT', r.data.submission?.status === 'DRAFT');
check('continutul persistat', JSON.parse(r.data.submission.content).strokes.length === 12);

r = await student2('GET', `/api/submissions/${subId}`);
check('alt elev NU vede lucrarea colegului', r.status === 403, `primit ${r.status}`);

r = await student('POST', `/api/submissions/${subId}/submit`, { content: drawing(15) });
check('tema predata', r.status === 200 && r.data.submission?.status === 'SUBMITTED');

r = await student('PATCH', `/api/submissions/${subId}`, { content: drawing(99) });
check('dupa predare nu mai poate modifica', r.status === 409, `primit ${r.status}`);

console.log('\n=== 7. Profesorul corecteaza ===');
r = await teacher('GET', `/api/lessons/${hwId}/submissions`);
const submitted = r.data.submissions?.filter((s) => s.status === 'SUBMITTED') ?? [];
check('profesorul vede lucrarea predata', submitted.length === 1);

r = await student('POST', `/api/submissions/${subId}/grade`, { grade: '10' });
check('elevul NU se poate nota singur', r.status === 403, `primit ${r.status}`);

r = await teacher('POST', `/api/submissions/${subId}/grade`, {
  grade: '9', comment: 'Bine lucrat, atentie la semnul minus.', feedback: drawing(4, '#dc2626'),
});
check('profesorul noteaza', r.status === 200 && r.data.submission?.status === 'GRADED');

r = await teacher('GET', `/api/submissions/${subId}`);
check('lucrarea elevului NU a fost suprascrisa de corectura',
  JSON.parse(r.data.submission.content).strokes.length === 15,
  `are ${JSON.parse(r.data.submission.content).strokes.length}`);
check('corectura salvata separat', JSON.parse(r.data.submission.feedback).strokes.length === 4);
check('nota salvata', r.data.submission.grade === '9');

r = await student('GET', `/api/submissions/${subId}`);
check('elevul isi vede nota si corectura', r.data.submission?.grade === '9' &&
  JSON.parse(r.data.submission.feedback).strokes.length === 4);

console.log('\n=== 8. Parintele ===');
r = await parent('POST', '/api/parent/link', { code: 'WRONGCOD' });
check('cod parinte invalid respins', r.status === 404);

r = await parent('GET', `/api/parent/children/${'x'.repeat(25)}`);
check('parinte fara legatura respins', r.status === 403 || r.status === 404);

r = await parent('POST', '/api/parent/link', { code: childLinkCode });
check('parintele se leaga de copil', r.status === 201, JSON.stringify(r.data));
const childId = r.data.child?.id;

r = await parent('POST', '/api/parent/link', { code: childLinkCode });
check('legatura dubla respinsa', r.status === 409);

r = await parent('GET', '/api/parent/children');
check('parintele vede copilul', r.data.children?.length === 1);
check('parintele vede statistica temelor',
  r.data.children?.[0]?.stats?.graded === 1,
  JSON.stringify(r.data.children?.[0]?.stats));

r = await parent('GET', `/api/parent/children/${childId}`);
check('parintele vede detaliile copilului', r.status === 200 && r.data.child?.submissions?.length >= 1);
check('parintele vede clasa copilului', r.data.child?.classes?.length === 1);

r = await parent('GET', `/api/submissions/${subId}`);
check('parintele vede lucrarea copilului', r.status === 200 && r.data.submission?.grade === '9');

// parintele NU trebuie sa vada lucrarile altor copii
r = await student2('GET', `/api/lessons/${hwId}`);
const sub2Id = r.data.mySubmission?.id;
r = await parent('GET', `/api/submissions/${sub2Id}`);
check('parintele NU vede lucrarea altui copil', r.status === 403, `primit ${r.status}`);

console.log('\n=== 9. Izolare intre profesori ===');
const teacher2 = makeClient();
await teacher2('POST', '/api/auth/register', {
  name: 'Prof. Altul', email: `prof2.${rnd}@test.ro`, password: 'parola1234', role: 'TEACHER',
});
r = await teacher2('GET', `/api/classes/${classId}`);
check('alt profesor NU vede clasa colegului', r.status === 403, `primit ${r.status}`);
r = await teacher2('POST', '/api/lessons', { topicId, title: 'Hack', type: 'THEORY' });
check('alt profesor NU poate adauga lectii', r.status === 403, `primit ${r.status}`);
r = await teacher2('POST', `/api/submissions/${subId}/grade`, { grade: '1' });
check('alt profesor NU poate nota', r.status === 403, `primit ${r.status}`);


console.log('\n=== 10. Mod live si notite ===');
// profesorul creeaza o lectie de teorie
r = await teacher('POST', '/api/lessons', { topicId, title: 'Lectie live', type: 'THEORY' });
const liveLessonId = r.data.lesson?.id;
check('lectie de teorie creata', r.status === 201);

r = await student('GET', `/api/lessons/${liveLessonId}/version`);
check('elevul NU vede lectia nepublicata', r.status === 404, `primit ${r.status}`);

r = await student('POST', `/api/lessons/${liveLessonId}/live`, { live: true });
check('elevul NU poate porni predarea', r.status === 403, `primit ${r.status}`);

r = await teacher('POST', `/api/lessons/${liveLessonId}/live`, { live: true });
check('profesorul porneste predarea', r.status === 200 && r.data.live === true, JSON.stringify(r.data));
check('pornirea publica automat lectia', r.data.published === true);

r = await student('GET', `/api/lessons/${liveLessonId}/version`);
check('elevul vede acum starea live', r.status === 200 && r.data.live === true);
const v1 = r.data.v;

// profesorul scrie
await teacher('PATCH', `/api/lessons/${liveLessonId}/content`, { content: drawing(7) });
r = await student('GET', `/api/lessons/${liveLessonId}/version`);
check('versiunea se schimba cand profesorul scrie', r.data.v !== v1, `${v1} -> ${r.data.v}`);

r = await student('GET', `/api/lessons/${liveLessonId}`);
check('elevul primeste continutul profesorului',
  JSON.parse(r.data.lesson.content).strokes.length === 7);

// notitele elevului
r = await student('GET', `/api/lessons/${liveLessonId}/notes`);
check('notitele pornesc goale', r.status === 200 && r.data.content === '');

r = await student('PATCH', `/api/lessons/${liveLessonId}/notes`, { content: drawing(5, '#1c1917') });
check('elevul isi salveaza notitele', r.status === 200);

r = await student('GET', `/api/lessons/${liveLessonId}/notes`);
check('notitele persista', JSON.parse(r.data.content).strokes.length === 5);

r = await teacher('PATCH', `/api/lessons/${liveLessonId}/content`, { content: drawing(9) });
r = await student('GET', `/api/lessons/${liveLessonId}`);
check('notitele elevului NU afecteaza lectia profesorului',
  JSON.parse(r.data.lesson.content).strokes.length === 9);
r = await student('GET', `/api/lessons/${liveLessonId}/notes`);
check('lectia profesorului NU suprascrie notitele elevului',
  JSON.parse(r.data.content).strokes.length === 5);

// notitele sunt private
r = await teacher('GET', `/api/lessons/${liveLessonId}/notes`);
check('profesorul NU poate citi notitele elevului', r.status === 403, `primit ${r.status}`);

r = await student2('GET', `/api/lessons/${liveLessonId}/notes`);
check('alt elev are notite separate', r.status === 200 && r.data.content === '');

r = await teacher('POST', `/api/lessons/${liveLessonId}/live`, { live: false });
check('profesorul opreste predarea', r.status === 200 && r.data.live === false);

r = await student('GET', `/api/lessons/${liveLessonId}/version`);
check('starea live s-a oprit', r.data.live === false);

const anon2 = makeClient();
r = await anon2('GET', `/api/lessons/${liveLessonId}/version`);
check('nelogat NU poate interoga versiunea', r.status === 401, `primit ${r.status}`);


console.log('\n=== 11. Sincronizare incrementala ===');
r = await teacher('POST', '/api/lessons', { topicId, title: 'Delta test', type: 'THEORY' });
const dId = r.data.lesson.id;
await teacher('POST', `/api/lessons/${dId}/live`, { live: true });

await teacher('PATCH', `/api/lessons/${dId}/content`, { content: drawing(10) });
r = await student('GET', `/api/lessons/${dId}/version`);
check('versiunea raporteaza numarul de trasee', r.data.n === 10, `n=${r.data.n}`);

r = await student('GET', `/api/lessons/${dId}/delta?since=0`);
check('delta de la zero da tot', r.data.strokes?.length === 10 && r.data.total === 10);

await teacher('PATCH', `/api/lessons/${dId}/content`, { content: drawing(25) });
r = await student('GET', `/api/lessons/${dId}/delta?since=10`);
check('delta da doar traseele noi', r.data.strokes?.length === 15, `primit ${r.data.strokes?.length}`);
check('delta nu cere reincarcare', r.data.reset === false);
check('delta raporteaza totalul corect', r.data.total === 25);

// masuram economia reala
const fullSize = JSON.stringify((await student('GET', `/api/lessons/${dId}`)).data).length;
const deltaSize = JSON.stringify((await student('GET', `/api/lessons/${dId}/delta?since=10`)).data).length;
check('delta e semnificativ mai mic decat lectia intreaga', deltaSize < fullSize * 0.7,
  `delta ${deltaSize} vs intreg ${fullSize}`);
console.log(`       delta ${deltaSize} octeti vs lectie intreaga ${fullSize} octeti`);

r = await student('GET', `/api/lessons/${dId}/delta?since=25`);
check('fara schimbari, delta e gol', r.data.strokes?.length === 0);

// profesorul sterge: numarul scade sub ce are elevul
await teacher('PATCH', `/api/lessons/${dId}/content`, { content: drawing(5) });
r = await student('GET', `/api/lessons/${dId}/delta?since=25`);
check('la stergere se cere reincarcare completa', r.data.reset === true, `reset=${r.data.reset}`);
check('reincarcarea da continutul curent', r.data.strokes?.length === 5);

r = await student2('GET', `/api/lessons/${dId}/delta?since=0`);
check('alt elev inscris poate cere delta', r.status === 200);

const anon3 = makeClient();
r = await anon3('GET', `/api/lessons/${dId}/delta?since=0`);
check('nelogat NU poate cere delta', r.status === 401, `primit ${r.status}`);

await teacher('DELETE', `/api/lessons/${dId}`);

console.log(`\n${'='.repeat(50)}`);
console.log(`REZULTAT: ${pass} trecute, ${fail} esuate`);
console.log('='.repeat(50));
process.exit(fail > 0 ? 1 : 0);
