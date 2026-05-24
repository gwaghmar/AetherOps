/**
 * Non-interactive reminder of env vars for operators. Does not write files.
 * Usage: npx tsx scripts/setup-wizard.ts
 */
const lines = [
  "AetherOps — setup reminder",
  "",
  "1. DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL",
  "2. DEFAULT_ORGANIZATION_ID or DEFAULT_ORGANIZATION_SLUG (org row must exist)",
  "3. npm run db:push && npm run db:seed (optional)",
  "4. Admin → AI: BYOK or APP_AI_PLATFORM_* + ALLOW_AI_PLATFORM_FALLBACK in prod",
  "5. RESEND_API_KEY + EMAIL_FROM for mail (optional in dev)",
  "6. Open /onboarding as admin after first login",
  "",
  "Full checklist: docs/SETUP.md",
];

console.log(lines.join("\n"));
