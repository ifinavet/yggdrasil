import { normalizeEmail } from "@workspace/shared/iam";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalQuery } from "../_generated/server";
import { sha256 } from "../lib/tokens";

// Resend reports opens only for domains with open tracking turned on in the Resend dashboard.
const CAPTURED_EVENTS = {
	"email.delivered": "resend-email_delivered",
	"email.opened": "resend-email_opened",
} as const;
type CapturedType = keyof typeof CAPTURED_EVENTS;
const CAPTURED_TYPES: readonly string[] = Object.keys(CAPTURED_EVENTS);

const POSTHOG_CAPTURE_URL = "https://eu.i.posthog.com/i/v0/e/";

export type CapturedEmailEvent = {
	type: CapturedType;
	emailId: string;
	recipient: string;
	createdAt: string;
};

/** The fields PostHog needs from a verified Resend webhook payload, or null to ignore it. */
export function capturedEmailEvent(payload: unknown): CapturedEmailEvent | null {
	if (typeof payload !== "object" || payload === null) return null;
	const { type, created_at: createdAt, data } = payload as Record<string, unknown>;
	if (typeof type !== "string" || !CAPTURED_TYPES.includes(type)) return null;
	if (typeof createdAt !== "string" || typeof data !== "object" || data === null) return null;
	const { email_id: emailId, to } = data as Record<string, unknown>;
	const recipient = Array.isArray(to) ? to[0] : to;
	if (typeof emailId !== "string" || typeof recipient !== "string") return null;
	return { type: type as CapturedType, emailId, recipient, createdAt };
}

export const userIdFor = internalQuery({
	args: { email: v.string() },
	handler: async (ctx, { email }): Promise<string | null> => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", email))
			.first();
		return user && !user.deleted ? user.externalId : null;
	},
});

export const capture = internalAction({
	args: {
		type: v.union(v.literal("email.delivered"), v.literal("email.opened")),
		emailId: v.string(),
		recipient: v.string(),
		createdAt: v.string(),
	},
	handler: async (ctx, { type, emailId, recipient, createdAt }): Promise<void> => {
		const token = process.env.POSTHOG_PROJECT_TOKEN;
		if (!token) return;
		const email = normalizeEmail(recipient);
		const userId = await ctx.runQuery(internal.emailAnalytics.capture.userIdFor, { email });
		const response = await fetch(POSTHOG_CAPTURE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: token,
				event: CAPTURED_EVENTS[type],
				// Recipients without an account, such as companies, are counted by a hash of their
				// address. PostHog never stores the address and makes no person profile for them.
				distinct_id: userId ?? `email:${await sha256(email)}`,
				timestamp: createdAt,
				properties: {
					email_id: emailId,
					recipient_type: userId ? "user" : "external",
					...(!userId && { $process_person_profile: false }),
				},
			}),
		});
		if (!response.ok) throw new Error(`PostHog responded with ${response.status}`);
	},
});
