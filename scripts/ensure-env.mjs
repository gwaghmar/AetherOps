/**
 * Ensures .env.local has required and recommended vars: appends missing lines,
 * generates secrets, fixes sslmode for Supabase. Preserves existing comments/order.
 * Usage: node scripts/ensure-env.mjs
 */
import { randomBytes } from "crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = join(root, ".env.example");
const localPath = join(root, ".env.local");

function b64(n) {
  return randomBytes(n).toString("base64");
}

function parseKeys(text) {
  const keys = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line.trim());
    if (m) keys.add(m[1]);
  }
  return keys;
}

function getVal(text, key) {
  const re = new RegExp(`^${key}=(.*)$`, "m");
  const m = re.exec(text);
  if (!m) return null;
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

if (!existsSync(examplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

if (!existsSync(localPath)) {
  copyFileSync(examplePath, localPath);
  console.log("Created .env.local from .env.example");
}

let body = readFileSync(localPath, "utf8");

// sslmode=require for Supabase (Drizzle + pg handle TLS)
if (body.includes("supabase.co") && body.includes("sslmode=no-verify")) {
  body = body.replace(/sslmode=no-verify/g, "sslmode=require");
  console.log("Updated DATABASE_URL: sslmode=require");
}

const keys = parseKeys(body);

const additions = [];

function need(key) {
  return !keys.has(key);
}

const gen = [
  ["API_KEY_PEPPER", () => b64(32)],
  ["CRON_SECRET", () => b64(24)],
  ["CHAT_INGEST_SECRET", () => b64(24)],
  ["FIELD_ENCRYPTION_KEY", () => b64(32)],
  ["APPROVAL_EMAIL_SECRET", () => b64(32)],
];

for (const [key, genFn] of gen) {
  if (need(key)) {
    additions.push(`${key}="${genFn()}"`);
    console.log(`Added ${key}`);
  }
}

if (additions.length) {
  body = body.replace(/\s*$/, "\n\n# --- added by scripts/ensure-env.mjs ---\n");
  body += additions.join("\n") + "\n";
}

writeFileSync(localPath, body);

const du = getVal(body, "DATABASE_URL") || "";
if (du.includes("YOUR_PASSWORD") || du.includes("YOUR_PROJECT_REF")) {
  console.warn(
    "[ensure-env] Set DATABASE_URL in .env.local from Supabase → Project Settings → Database (URI).",
  );
}

console.log(`Done: ${localPath}`);
