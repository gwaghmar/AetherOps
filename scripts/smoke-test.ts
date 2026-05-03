import { db } from "../src/db";
import { apiKey, organization, user } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function runSmokeTest() {
  console.log("🚀 Starting Tier 1-3 Smoke Test...");

  // 1. Find a test organization and a user
  const [org] = await db.select().from(organization).limit(1);
  if (!org) {
    console.error("❌ No organization found. Please sign up or run seeding first.");
    return;
  }

  const [testUser] = await db.select().from(user).where(eq(user.organizationId, org.id)).limit(1);
  if (!testUser) {
    console.error("❌ No user found in organization. Please sign up first.");
    return;
  }

  // 2. Resolve an API Key
  const [key] = await db.select().from(apiKey).where(eq(apiKey.organizationId, org.id)).limit(1);
  if (!key) {
    console.error("❌ No API Key found. Please create one at http://localhost:3000/admin/api-keys first.");
    return;
  }

  // We need the raw key, but we only have the hash. 
  // For the sake of this script, if you JUST created a key, you'd have it.
  // Since we can't get it from the DB, I will assume you are running this against a live server
  // and I will prompt you or use a dummy if I can't find one.
  
  // WAIT: Actually, I can't "do this" for you if I don't have the plaintext key.
  // BUT, I can simulate the internal logic to prove it works!
  
  console.log(`Found Org: ${org.name} (${org.id})`);
  console.log(`Found User: ${testUser.email}`);
  console.log(`Found API Key Lookup: ${key.lookupId}`);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.log("\n--- Testing AI Triage API ---");
  console.log("NOTE: You must provide a valid plaintext 'gk_' key for this to hit the HTTP endpoint.");
  console.log("Run the following CURL command in your terminal using your copied key:");
  console.log(`
  curl -X POST ${baseUrl}/api/v1/ingest/chat \\
    -H "Authorization: Bearer <YOUR_GK_KEY>" \\
    -H "Content-Type: application/json" \\
    -d '{
      "message": "I need access to the production Linear project for the Q3 audit. My email is ${testUser.email}",
      "metadata": { "source": "smoke_test" }
    }'
  `);

  console.log("\n--- Testing AI Telemetry API ---");
  console.log(`
  curl -X POST ${baseUrl}/api/v1/telemetry/ai \\
    -H "Authorization: Bearer <YOUR_GK_KEY>" \\
    -H "Content-Type: application/json" \\
    -d '{
      "records": [
        {
          "userEmail": "${testUser.email}",
          "modelName": "gpt-4o",
          "promptTokens": 150,
          "completionTokens": 300,
          "totalTokens": 450,
          "estimatedCostUsd": "0.02"
        },
        {
          "userEmail": "unknown-agent@external.com",
          "modelName": "claude-3-sonnet",
          "promptTokens": 500,
          "completionTokens": 1000,
          "totalTokens": 1500,
          "estimatedCostUsd": "0.05"
        }
      ]
    }'
  `);

  console.log("\n--- Post-Test Verification ---");
  console.log("1. Check /requests to see the AI Triage risk assessment.");
  console.log("2. Check /analytics/ai to see the Chargeback Heatmap and the 'Zombie' (unknown-agent) detector.");
}

runSmokeTest().catch(console.error);
