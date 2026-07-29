// Verificare a aplicatiei live: login real + citire date + verificare autorizare.
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
    try { d = t ? JSON.parse(t) : {}; } catch { d = { _html: t.slice(0, 300) }; }
    return { status: res.status, data: d, text: t };
  };
}

console.log('=== Pagini publice ===');
let r = await fetch(BASE + '/login');
ok('pagina de login raspunde', r.status === 200, r.status);
const html = await r.text();
ok('continut ZestPad randat', html.includes('ZestPad'));
ok('nu e aplicatia veche Vite', !html.includes('vite.svg'));

r = await fetch(BASE + '/manifest.json');
ok('manifest PWA servit', r.status === 200);
r = await fetch(BASE + '/sw.js');
ok('service worker servit', r.status === 200);

console.log('\n=== Profesor ===');
const t = client();
r = await t('POST', '/api/auth/login', { email: 'profesor@zestpad.demo', password: 'zestpad123' });
ok('autentificare profesor', r.status === 200, JSON.stringify(r.data).slice(0, 200));
ok('rol corect', r.data.user?.role === 'TEACHER');

r = await t('GET', '/api/classes');
ok('citeste clasele din baza Railway', r.status === 200 && r.data.classes?.length >= 1,
  `${r.data.classes?.length} clase`);
const classId = r.data.classes?.[0]?.id;
ok('clasa demo prezenta', r.data.classes?.[0]?.name?.includes('Matematic'));

r = await t('GET', `/api/classes/${classId}`);
ok('detalii clasa', r.status === 200 && (r.data.class?.topics?.length ?? 0) >= 2, `\ capitole`);
ok('profesorul vede elevii', (r.data.class?.students?.length ?? 0) >= 2);

console.log('\n=== Elev ===');
const s = client();
r = await s('POST', '/api/auth/login', { email: 'elev@zestpad.demo', password: 'zestpad123' });
ok('autentificare elev', r.status === 200);
r = await s('GET', '/api/me/link-code');
ok('cod pentru parinte', r.data.linkCode === 'DEMO2345', r.data.linkCode);

console.log('\n=== Autorizare (ce NU trebuie sa mearga) ===');
r = await s('POST', '/api/topics', { classId, title: 'Test', background: 'WHITE' });
ok('elevul NU poate crea capitole', r.status === 403, `primit ${r.status}`);

const anon = client();
r = await anon('GET', '/api/classes');
ok('nelogat respins', r.status === 401, `primit ${r.status}`);

r = await anon('POST', '/api/auth/login', { email: 'profesor@zestpad.demo', password: 'gresit' });
ok('parola gresita respinsa', r.status === 401);

console.log('\n=== Parinte ===');
const p = client();
r = await p('POST', '/api/auth/login', { email: 'parinte@zestpad.demo', password: 'zestpad123' });
ok('autentificare parinte', r.status === 200);
r = await p('GET', '/api/parent/children');
ok('vede copilul', r.data.children?.length === 1, JSON.stringify(r.data).slice(0, 150));
ok('vede tema notata', (r.data.children?.[0]?.stats?.graded ?? 0) >= 1,
  JSON.stringify(r.data.children?.[0]?.stats));

console.log(`\n${'='.repeat(46)}`);
console.log(`REZULTAT PRODUCTIE: ${pass} trecute, ${fail} esuate`);
console.log('='.repeat(46));
process.exit(fail > 0 ? 1 : 0);
