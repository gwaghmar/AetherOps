import { randomUUID } from "crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { intakeConversation } from "@/db/schema";

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type ConversationState =
  | "awaiting_clarification"
  | "awaiting_confirmation"
  | "resolved"
  | "expired";

export type IntakeConversationRow = typeof intakeConversation.$inferSelect;

export async function getOpenConversation(
  channel: string,
  channelUserId: string,
): Promise<IntakeConversationRow | null> {
  const [row] = await db
    .select()
    .from(intakeConversation)
    .where(
      and(
        eq(intakeConversation.channel, channel),
        eq(intakeConversation.channelUserId, channelUserId),
        sql`${intakeConversation.state} in ('awaiting_clarification', 'awaiting_confirmation')`,
        gt(intakeConversation.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createConversation(input: {
  organizationId: string;
  channel: string;
  channelUserId: string;
  channelThreadId?: string | null;
  resolvedUserId?: string | null;
  state: ConversationState;
  detectedRequestTypeSlug?: string | null;
  detectedPayload?: Record<string, unknown> | null;
  turnCount?: number;
}): Promise<IntakeConversationRow> {
  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS);
  const [row] = await db
    .insert(intakeConversation)
    .values({
      id: randomUUID(),
      organizationId: input.organizationId,
      channel: input.channel,
      channelUserId: input.channelUserId,
      channelThreadId: input.channelThreadId ?? null,
      resolvedUserId: input.resolvedUserId ?? null,
      state: input.state,
      detectedRequestTypeSlug: input.detectedRequestTypeSlug ?? null,
      detectedPayload: input.detectedPayload ?? null,
      turnCount: input.turnCount ?? 0,
      expiresAt,
    })
    .returning();
  return row;
}

export async function updateConversation(
  id: string,
  patch: Partial<{
    state: ConversationState;
    channelThreadId: string | null;
    resolvedUserId: string | null;
    detectedRequestTypeSlug: string | null;
    detectedPayload: Record<string, unknown> | null;
    turnCount: number;
  }>,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CONVERSATION_TTL_MS);
  await db
    .update(intakeConversation)
    .set({ ...patch, expiresAt, updatedAt: new Date() })
    .where(eq(intakeConversation.id, id));
}

export async function resolveConversation(id: string): Promise<void> {
  await db
    .update(intakeConversation)
    .set({ state: "resolved", updatedAt: new Date() })
    .where(eq(intakeConversation.id, id));
}

export async function expireStaleConversations(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(intakeConversation)
    .set({ state: "expired", updatedAt: now })
    .where(
      and(
        lt(intakeConversation.expiresAt, now),
        sql`${intakeConversation.state} in ('awaiting_clarification', 'awaiting_confirmation')`,
      ),
    )
    .returning({ id: intakeConversation.id });
  return result.length;
}
