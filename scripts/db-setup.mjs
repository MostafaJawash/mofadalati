// Creates the schema and seeds the admission data extracted from the ministry PDF.
// Usage:
//   npm run db:setup                      create tables, seed admissions if empty
//   npm run db:setup -- --reset-admissions  replace all admissions (clears preferences)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (existsSync(p)) process.loadEnvFile(p);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example).");
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL === "true" || /sslmode=require/.test(url);
const client = new pg.Client({
  // Strip sslmode: pg would treat it as verify-full and override `ssl` below.
  connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

const reset = process.argv.includes("--reset-admissions");

await client.connect();
try {
  await client.query(readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  console.log("Schema ready.");

  const { rows } = await client.query("SELECT count(*)::int AS n FROM admissions");
  if (rows[0].n > 0 && !reset) {
    console.log(`Admissions already seeded (${rows[0].n} rows). Use --reset-admissions to replace.`);
  } else {
    const data = JSON.parse(readFileSync(path.join(root, "db", "admissions.json"), "utf8"));
    await client.query("BEGIN");
    if (reset) await client.query("TRUNCATE preferences, admissions RESTART IDENTITY");
    for (const a of data) {
      await client.query(
        `INSERT INTO admissions (specialization, university, city, category,
           general_available, general_minimum, general_conditions,
           parallel_available, parallel_minimum, parallel_conditions,
           source_page, source_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          a.specialization, a.university, a.city, a.category,
          a.general_available, a.general_minimum, a.general_conditions,
          a.parallel_available, a.parallel_minimum, a.parallel_conditions,
          a.source_page, a.source_order,
        ],
      );
    }
    await client.query(
      "INSERT INTO audit_log (action, actor, details) VALUES ($1, $2, $3)",
      ["admissions_seeded", "system", { count: data.length, reset }],
    );
    await client.query("COMMIT");
    console.log(`Seeded ${data.length} admissions.`);
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
