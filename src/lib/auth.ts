import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sso } from "@better-auth/sso";
import { scim } from "@better-auth/scim";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getTrustedAuthOrigins } from "@/lib/env";

async function resolveSignupOrganizationId(): Promise<string | undefined> {
  const byId = process.env.DEFAULT_ORGANIZATION_ID?.trim();
  if (byId) {
    const [org] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, byId))
      .limit(1);
    if (org) return org.id;
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `DEFAULT_ORGANIZATION_ID (${byId}) does not match any organization`,
      );
    }
  }

  const slug = process.env.DEFAULT_ORGANIZATION_SLUG?.trim();
  if (slug) {
    const [org] = await db
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.slug, slug))
      .limit(1);
    if (org) return org.id;
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `DEFAULT_ORGANIZATION_SLUG (${slug}) does not match any organization`,
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DEFAULT_ORGANIZATION_ID or DEFAULT_ORGANIZATION_SLUG must resolve to an existing organization",
    );
  }

  /** Prefer seeded demo org so local `npm run db:seed` tiles match new signups. */
  const [byDemoId] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.id, "org_demo"))
    .limit(1);
  if (byDemoId) return byDemoId.id;

  const [byDemoSlug] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, "demo"))
    .limit(1);
  if (byDemoSlug) return byDemoSlug.id;

  const [fallback] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .limit(1);
  return fallback?.id;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedAuthOrigins(),
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      // Only require HTTPS cookies when the public auth URL is HTTPS (avoids
      // breaking `next start` on http://localhost while NODE_ENV=production).
      secure: process.env.BETTER_AUTH_URL?.startsWith("https://") === true,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          const orgId = await resolveSignupOrganizationId();
          return {
            data: {
              ...u,
              organizationId: orgId ?? u.organizationId,
            },
          };
        },
        after: async (created) => {
          const [row] = await db
            .select({ n: count() })
            .from(schema.user);
          if (row.n === 1) {
            await db
              .update(schema.user)
              .set({ role: "admin" })
              .where(eq(schema.user.id, created.id));
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      const { sendTransactionalEmail } = await import(
        "@/server/email/send-email"
      );
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your password",
        html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p>
<p><a href="${url}">${url}</a></p>
<p>If you did not request a password reset, you can ignore this email.</p>`,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "requester",
        input: false,
      },
      organizationId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            tenantId: process.env.MICROSOFT_TENANT_ID,
          },
        }
      : {}),
  },
  plugins: [
    sso(),
    scim(),
  ],
});
