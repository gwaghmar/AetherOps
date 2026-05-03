import { NextResponse } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { scimProvider } from "@/db/auth-schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// Minimal inbound SCIM 2.0 /Users endpoint mapping directly to multi-tenant orgs
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "").trim();

  // Find the SCIM provider / organization by token
  const [provider] = await db
    .select()
    .from(scimProvider)
    .where(eq(scimProvider.scimToken, token))
    .limit(1);

  if (!provider || !provider.organizationId) {
    return NextResponse.json({ error: "Unauthorized or unmapped token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    
    // Extract standard SCIM fields (e.g. from Okta/Entra)
    const email = body.emails?.[0]?.value || body.userName;
    const name = body.name ? `${body.name.givenName || ''} ${body.name.familyName || ''}`.trim() : (body.displayName || email);
    const department = body.title || body.department;

    if (!email) {
      return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Email or userName is required", status: "400" }, { status: 400 });
    }

    const id = randomUUID();
    const [createdUser] = await db.insert(user).values({
      id,
      name,
      email,
      organizationId: provider.organizationId,
      department,
      role: "requester", // Default SCIM provisions are standard requesters
    }).onConflictDoUpdate({
      target: user.email,
      set: {
        name,
        department,
        updatedAt: new Date(),
      }
    }).returning();

    // Return standard SCIM 2.0 User response format expected by IdPs
    return NextResponse.json({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: createdUser.id,
      userName: createdUser.email,
      name: {
        formatted: createdUser.name
      },
      emails: [
        {
          value: createdUser.email,
          primary: true
        }
      ],
      active: true,
      meta: {
        resourceType: "User",
        created: createdUser.createdAt.toISOString(),
        lastModified: createdUser.updatedAt.toISOString(),
      }
    }, { status: 201 });

  } catch (err) {
    console.error("SCIM Error:", err);
    return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Internal Server Error", status: "500" }, { status: 500 });
  }
}
