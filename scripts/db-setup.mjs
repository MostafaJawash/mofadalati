// Creates the schema and seeds the admission data extracted from the ministry PDF.
// Usage:
//   npm run db:setup                        create tables, seed any dataset not yet loaded
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

  // Each data file is seeded independently, identified by the categories it holds,
  // so new datasets can be added to an existing database without touching old rows.
  const datasets = [
    { file: "admissions.json", categories: ["ministry", "defense", "security"] },
    { file: "private-admissions.json", categories: ["private"] },
  ];
  await client.query("BEGIN");
  if (reset) await client.query("TRUNCATE preferences, admissions RESTART IDENTITY");
  for (const { file, categories } of datasets) {
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM admissions WHERE category = ANY($1)",
      [categories],
    );
    if (rows[0].n > 0) {
      console.log(`${file}: already seeded (${rows[0].n} rows).`);
      continue;
    }
    const data = JSON.parse(readFileSync(path.join(root, "db", file), "utf8"));
    await client.query(
      `INSERT INTO admissions (specialization, university, city, category,
         general_available, general_minimum, general_conditions,
         parallel_available, parallel_minimum, parallel_conditions,
         source_page, source_order)
       SELECT specialization, university, city, category,
         general_available, general_minimum, general_conditions,
         parallel_available, parallel_minimum, parallel_conditions,
         source_page, source_order
       FROM jsonb_to_recordset($1::jsonb) AS x(
         specialization text, university text, city text, category text,
         general_available boolean, general_minimum numeric, general_conditions text,
         parallel_available boolean, parallel_minimum numeric, parallel_conditions text,
         source_page int, source_order int)`,
      [JSON.stringify(data)],
    );
    await client.query(
      "INSERT INTO audit_log (action, actor, details) VALUES ($1, $2, $3)",
      ["admissions_seeded", "system", { count: data.length, file, reset }],
    );
    console.log(`${file}: seeded ${data.length} admissions.`);
  }
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
