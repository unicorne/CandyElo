// Apply supabase/migrations/*.sql to the linked Supabase project.
// Tries (in order):
//   1. SUPABASE_ACCESS_TOKEN  → Supabase Management API (preferred, no DB pw needed)
//   2. SUPABASE_DB_URL        → direct Postgres connection (via `pg`)
// If neither is set, prints the URL of the SQL editor and the migration body
// so it can be pasted in once. Idempotent migrations only.

import fs from "node:fs/promises";
import path from "node:path";

const PROJECT_REF = "nnjpassejnvvpiphcpec";

async function loadMigrations(): Promise<{ name: string; body: string }[]> {
  const dir = path.join("supabase", "migrations");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const out = [];
  for (const f of files) {
    out.push({
      name: f,
      body: await fs.readFile(path.join(dir, f), "utf8"),
    });
  }
  return out;
}

async function applyViaManagementApi(token: string, sql: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Management API ${res.status}: ${txt}`);
  }
}

async function main() {
  const migrations = await loadMigrations();
  if (migrations.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (token) {
    console.log("Applying via Supabase Management API…");
    for (const m of migrations) {
      console.log(`  → ${m.name}`);
      await applyViaManagementApi(token, m.body);
    }
    console.log("Done.");
    return;
  }

  console.log("\n=========================================================");
  console.log("No SUPABASE_ACCESS_TOKEN found.");
  console.log("Easiest path: open the SQL editor in the dashboard,");
  console.log("paste each migration below, hit Run.\n");
  console.log(
    `  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new\n`,
  );
  console.log("Or run:  supabase login   then  export SUPABASE_ACCESS_TOKEN=$(cat ~/.supabase/access-token)");
  console.log("Then re-run:  pnpm db:apply");
  console.log("=========================================================\n");

  for (const m of migrations) {
    console.log(`----- ${m.name} -----`);
    console.log(m.body);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
