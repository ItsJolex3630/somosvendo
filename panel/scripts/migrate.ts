import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (!url) throw new Error("Falta DATABASE_URL en .env.local");

  const client = createClient({ url, authToken });
  const dir = join(process.cwd(), "drizzle");

  await client.execute(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Destino: ${url}`);
  for (const file of files) {
    const applied = await client.execute({
      sql: "SELECT name FROM _migrations WHERE name = ?",
      args: [file],
    });
    if (applied.rows.length) {
      console.log(`- ${file} (ya aplicada)`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    await client.executeMultiple(sql);
    await client.execute({ sql: "INSERT INTO _migrations (name) VALUES (?)", args: [file] });
    console.log(`✓ ${file} aplicada`);
  }

  client.close();
  console.log("Migraciones completadas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
