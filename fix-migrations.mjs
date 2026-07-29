// Inspecteaza si curata inregistrarile de migrare din _prisma_migrations.
// Ruleaza cu --fix ca sa stearga efectiv; fara, doar afiseaza.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync('.env', 'utf8');
const url = env.match(/DATABASE_URL="([^"]+)"/)[1].replace(/[?&]sslmode=[^&]*/, '');
const doFix = process.argv.includes('--fix');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(`
  SELECT migration_name, finished_at, rolled_back_at, applied_steps_count, started_at
  FROM _prisma_migrations ORDER BY started_at
`);

console.log('Inregistrari in _prisma_migrations:\n');
for (const r of rows) {
  const stare = r.rolled_back_at ? 'ANULATA' : r.finished_at ? 'aplicata' : 'ESUATA';
  console.log(`  ${r.migration_name}`);
  console.log(`    stare: ${stare}   pornita: ${r.started_at?.toISOString() ?? '-'}`);
}

// Migrarea veche nu exista in codul actual. O stergem, nu o "rezolvam",
// pentru ca nu face parte din istoricul acestei aplicatii.
const straina = rows.filter((r) => r.migration_name === '20260109142419_add_background_to_topic');

if (straina.length === 0) {
  console.log('\nNicio inregistrare straina. Baza e curata.');
} else if (doFix) {
  const res = await client.query(
    `DELETE FROM _prisma_migrations WHERE migration_name = $1`,
    ['20260109142419_add_background_to_topic']
  );
  console.log(`\nSters: ${res.rowCount} inregistrare straina.`);
} else {
  console.log(`\nGasit ${straina.length} inregistrare straina (de la backend-ul vechi).`);
  console.log('Ruleaza cu --fix ca sa o stergi.');
}

await client.end();
