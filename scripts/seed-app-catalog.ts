import "dotenv/config";
import { db } from "../src/db/index";
import { appCatalog, organization } from "../src/db/app-schema";
import crypto from "crypto";

const TARGET_APPS = [
  {
    appName: "Google Workspace",
    vendor: "Google",
    category: "Identity & Collaboration",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Workspace seat limits depend on tier.",
    setupGuideUrl: "https://workspace.google.com/setup",
  },
  {
    appName: "GitHub Enterprise",
    vendor: "Microsoft",
    category: "Development",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Enterprise managed accounts only.",
    setupGuideUrl: "https://docs.github.com/en/enterprise-cloud@latest",
  },
  {
    appName: "Slack",
    vendor: "Salesforce",
    category: "Communication",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Depends on Enterprise Grid vs Pro.",
    setupGuideUrl: "https://slack.com/help",
  },
  {
    appName: "AWS",
    vendor: "Amazon",
    category: "Cloud Infrastructure",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "full_cost",
    knownLimits: "AWS IAM Identity Center (SSO) required.",
    setupGuideUrl: "https://aws.amazon.com/iam/identity-center/",
  },
  {
    appName: "OpenAI Enterprise",
    vendor: "OpenAI",
    category: "Generative AI",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "full_cost",
    knownLimits: "Requires 150 seat minimum for SCIM.",
    setupGuideUrl: "https://help.openai.com",
  },
  {
    appName: "Linear",
    vendor: "Linear",
    category: "Project Management",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Plus plan required for SAML.",
    setupGuideUrl: "https://linear.app/docs",
  },
  {
    appName: "Notion",
    vendor: "Notion",
    category: "Documentation",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Enterprise plan required for User Provisioning.",
    setupGuideUrl: "https://www.notion.so/help",
  },
  {
    appName: "Claude for Work / Anthropic",
    vendor: "Anthropic",
    category: "Generative AI",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "partial",
    knownLimits: "SAML and usage metrics slowly rolling out.",
    setupGuideUrl: "https://support.anthropic.com",
  },
  {
    appName: "Vercel",
    vendor: "Vercel",
    category: "Cloud Hosting",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Enterprise plan required for SAML.",
    setupGuideUrl: "https://vercel.com/docs",
  },
  {
    appName: "Okta / Entra",
    vendor: "Identity System",
    category: "Identity Provider",
    connectorType: "manual_ticketing",
    ssoSupport: "true",
    telemetrySupport: "none",
    knownLimits: "Super admin access requires strong approval.",
    setupGuideUrl: "https://help.okta.com",
  }
];

async function run() {
  const orgs = await db.select().from(organization).limit(1);
  if (orgs.length === 0) {
    console.warn("No organization found. Cannot seed app catalog yet. Run normal seeder first.");
    process.exit(1);
  }
  const orgId = orgs[0].id;

  const catalogInserts = TARGET_APPS.map(app => ({
    id: crypto.randomUUID(),
    organizationId: orgId,
    ...app
  }));

  for (const row of catalogInserts) {
    try {
      await db.insert(appCatalog).values(row);
      console.log(`Inserted ${row.appName}`);
    } catch (e: unknown) {
      // ignore unique constraint errors if re-running
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`Skipped ${row.appName} - ${msg}`);
    }
  }

  console.log("✅ App Catalog seeding complete.");
  process.exit(0);
}

run().catch(e => {
  console.error("Seeding failed:", e);
  process.exit(1);
});
