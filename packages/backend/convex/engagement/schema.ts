import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { registrationStatusValidator } from "../events/schema";

export const REGISTRATION_CHANGES = [
	"registered",
	"waitlisted",
	"offered",
	"accepted",
	"expired",
	"unregistered",
	"cleared",
] as const;

export const ALERT_RULES = ["unregisterWave", "behindPace", "noRegistrations"] as const;

export const registrationChange = v.union(
	...REGISTRATION_CHANGES.map((change) => v.literal(change)),
);
export const alertRule = v.union(...ALERT_RULES.map((rule) => v.literal(rule)));

export type RegistrationChange = Infer<typeof registrationChange>;
export type AlertRule = Infer<typeof alertRule>;

export const engagementSchema = {
	registrationLog: defineTable({
		eventId: v.id("events"),
		userId: v.id("users"),
		change: registrationChange,
		fromStatus: v.optional(registrationStatusValidator),
		at: v.number(),
	})
		.index("by_eventId_and_at", ["eventId", "at"])
		.index("by_eventId_and_userId", ["eventId", "userId"])
		.index("by_userId_and_at", ["userId", "at"])
		.index("by_at", ["at"]),

	engagementAlerts: defineTable({
		eventId: v.id("events"),
		rule: alertRule,
		summary: v.string(),
		detail: v.string(),
		triggeredAt: v.number(),
		dismissedAt: v.optional(v.number()),
	})
		.index("by_eventId_and_rule", ["eventId", "rule"])
		.index("by_dismissedAt_and_triggeredAt", ["dismissedAt", "triggeredAt"]),
};
