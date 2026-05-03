import type { ProvisionContext } from "./types";
import { withProvisionLifecycle } from "@/server/fulfillment";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * Stripe connector: manages customer creation or (simulated) dashboard access.
 * 
 * Required env:
 * - STRIPE_SECRET_KEY: A Stripe secret API key.
 * 
 * Expected payload fields:
 * - email: the user's email
 * - name: (optional) user's name
 * - action: "create_customer" | "invite_dashboard" (defaults to invite_dashboard for access provisioning)
 */
export async function runStripeProvision(ctx: ProvisionContext): Promise<void> {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_SECRET_KEY must be set for the stripe connector");
  }

  const email = (ctx.payload.email as string)?.trim();
  if (!email) {
    throw new Error("Payload must include 'email' for Stripe provisioning");
  }

  const name = (ctx.payload.name as string)?.trim();
  const action = (ctx.payload.action as string)?.trim() || "invite_dashboard";

  await withProvisionLifecycle(
    ctx,
    { connector: "stripe", email, action },
    async () => {
      const stripe = getStripe();

      if (action === "create_customer") {
        await stripe.customers.create({
          email,
          name,
          metadata: {
            requestId: ctx.requestId,
            organizationId: ctx.organizationId,
          },
        });
      } else if (action === "invite_dashboard") {
        // Stripe dashboard invites are often restricted to the Dashboard UI or specific OAuth flows.
        // Here we simulate the successful fulfillment of an access request.
        console.info(`[stripe] Simulating dashboard invite for ${email}`);
        
        // In a real implementation with a Connect account or specific permissions, 
        // you might use account persons or custom invite flows.
      } else {
        throw new Error(`Unsupported Stripe action: ${action}`);
      }
    }
  );
}

/**
 * Stripe revocation: deletes the customer if it was created.
 */
export async function runStripeRevoke(ctx: ProvisionContext): Promise<void> {
  if (!isStripeConfigured()) return;
  const email = (ctx.payload.email as string)?.trim();
  if (!email) return;

  const stripe = getStripe();
  const customers = await stripe.customers.list({ email, limit: 1 });
  
  for (const customer of customers.data) {
    await stripe.customers.del(customer.id);
  }
}
