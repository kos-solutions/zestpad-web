// Sterge conturile si clasele create de testele de incarcare.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL="([^"]+)"/)[1].replace(/[?&]sslmode=[^&]*/, '');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const before = (await c.query(`SELECT count(*)::int n FROM "User"`)).rows[0].n;

// conturile de test au domeniul test.local
const del = await c.query(`DELETE FROM "User" WHERE email LIKE '%@test.local'`);
// clasele de proba raman orfane doar daca profesorul a fost sters cu CASCADE;
// pentru siguranta stergem si ce a mai ramas dupa nume
const cls = await c.query(`DELETE FROM "Class" WHERE name LIKE '\\_\\_%'`);

const after = (await c.query(`SELECT count(*)::int n FROM "User"`)).rows[0].n;

console.log(`Conturi de test sterse: ${del.rowCount}`);
console.log(`Clase de proba sterse:  ${cls.rowCount}`);
console.log(`Utilizatori: ${before} -> ${after}`);

console.log('\nRamas in baza:');
for (const u of (await c.query(`SELECT name, email, role FROM "User" ORDER BY role, name`)).rows) {
  console.log(`  ${u.role.padEnd(8)} ${u.name.padEnd(18)} ${u.email}`);
}
for (const k of (await c.query(`SELECT name, code FROM "Class" WHERE archived = false`)).rows) {
  console.log(`  CLASA    ${k.name}  [${k.code}]`);
}

await c.end();
