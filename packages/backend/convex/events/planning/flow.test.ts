import type { EmailId } from "@convex-dev/resend";
import { DAY_MS, eventPlanningAt } from "@workspace/shared/time";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertFoodItem,
	insertOrganizer,
	insertUser,
	setup,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import { trackedEmail } from "../../lib/trackedEmail";
import { prepareDue } from "./lifecycle";

const NOW = Date.parse("2026-10-01T10:00:00Z");
const START = NOW + 30 * DAY_MS;
const tokenFrom = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get("token")!;
async function fixture() {
	const { t, companyId } = await setup();
	const eventId = await insertEvent(t, companyId, { eventStart: START, published: false });
	const lead = await insertUser(t, "lead@ifinavet.no");
	const helper = await insertUser(t, "helper@ifinavet.no");
	await grantRole(t, lead._id, "internal");
	await insertOrganizer(t, eventId, lead._id);
	await insertOrganizer(t, eventId, helper._id, "medhjelper");
	const editor = asUser(t, lead);
	const initial = await editor.query(api.events.planning.admin.get, { eventId });
	expect(initial.initial.answers.startTime).toBe("16:15");
	const preparation = {
		...initial.initial,
		contactName: "Bedrift",
		contactEmail: "contact@example.com",
		eventType: "standard_presentation" as const,
		answers: {
			...initial.initial.answers,
			title: "Bli kjent med oss",
			teaser: "Møt utviklerne våre",
			description: "<p>Faglig innhold</p>",
			capacity: 40,
			language: "Norsk",
			alcohol: "no" as const,
			ageRestriction: "none" as const,
		},
	};
	await editor.mutation(api.events.planning.admin.savePreparation, {
		eventId,
		revision: 0,
		...preparation,
	});
	const data = await editor.query(api.events.planning.admin.get, { eventId });
	return { t, eventId, editor, data, preparation };
}
async function invited() {
	const f = await fixture();
	await f.editor.mutation(api.events.planning.admin.send, {
		eventId: f.eventId,
		revision: f.data.planning!.revision,
		fingerprint: f.data.preview!.fingerprint,
	});
	const mail = (await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect()))[0]!;
	const token = tokenFrom(mail.url);
	const form = (await f.t.query(api.events.planning.public.get, { token, now: NOW }))!;
	return { ...f, mail, token, form };
}
async function submitted() {
	const f = await invited();
	const submissionId = crypto.randomUUID();
	const input = {
		token: f.token,
		submissionId,
		revision: f.form.revision,
		answers: f.form.answers,
	};
	await f.t.mutation(api.events.planning.public.submit, input);
	const emails = await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect());
	const confirmation = emails.find((e) => e.kind === "confirmation")!;
	return { ...f, input, confirmation, confirmationToken: tokenFrom(confirmation.url) };
}
beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	vi.stubEnv("APP_ENV", "local");
	vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("company event planning", () => {
	it("keeps a requested package change for review without increasing the agreed capacity", async () => {
		const f = await invited();
		const before = await f.t.run((ctx) => ctx.db.get(f.eventId));
		const input = {
			token: f.token,
			submissionId: crypto.randomUUID(),
			revision: f.form.revision,
			answers: {
				...f.form.answers,
				requestedEventType: "large_presentation" as const,
				capacity: 80,
			},
		};
		await expect(f.t.mutation(api.events.planning.public.submit, input)).rejects.toThrow();
		await f.t.mutation(api.events.planning.public.submit, {
			...input,
			answers: { ...input.answers, capacity: 40 },
		});
		const submission = await f.t.run((ctx) => ctx.db.query("eventPlanningSubmissions").first());
		expect(submission?.answers.requestedEventType).toBe("large_presentation");
		expect(submission?.draft.requestedEventType).toBe("large_presentation");
		expect(
			(await f.t.query(api.events.planning.public.get, { token: f.token, now: NOW }))
				?.capacityLimit,
		).toBe(40);
		const event = await f.t.run((ctx) => ctx.db.get(f.eventId));
		expect(event?.participationLimit).toBe(before?.participationLimit);
	});

	it("prepares orderless events five weeks before and queues each Slack notice only once, without emailing", async () => {
		const { t, companyId } = await setup();
		const eventId = await insertEvent(t, companyId, { eventStart: START });
		const due = eventPlanningAt(START, 35);
		await t.run(async (ctx) => {
			const event = (await ctx.db.get(eventId))!;
			await prepareDue(ctx, event, due - 1);
		});
		expect(await t.run((ctx) => ctx.db.query("eventPlanning").collect())).toHaveLength(0);
		await t.run(async (ctx) => {
			const event = (await ctx.db.get(eventId))!;
			await prepareDue(ctx, event, due);
			await prepareDue(ctx, event, due);
		});
		expect(await t.run((ctx) => ctx.db.query("eventPlanning").collect())).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query("eventPlanningEmails").collect())).toHaveLength(0);
		expect(await t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect())).toHaveLength(1);
	});
	it("requires internal authorization and rejects changed invitation previews", async () => {
		const f = await fixture();
		await expect(
			f.t.query(api.events.planning.admin.get, { eventId: f.eventId }),
		).rejects.toThrow();
		await expect(
			f.editor.mutation(api.events.planning.admin.send, {
				eventId: f.eventId,
				revision: f.data.planning!.revision,
				fingerprint: "stale",
			}),
		).rejects.toThrow();
		expect(await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect())).toHaveLength(0);
	});
	it("uses organizer CC and Reply-To and suppresses duplicate send actions", async () => {
		const f = await invited();
		expect(f.mail.envelope.cc).toEqual(["lead@ifinavet.no", "helper@ifinavet.no"]);
		expect(f.mail.envelope.replyTo).toEqual(["lead@ifinavet.no"]);
		expect(f.mail.envelope.text).toContain(f.preparation.signature);
		await expect(
			f.editor.mutation(api.events.planning.admin.send, {
				eventId: f.eventId,
				revision: f.data.planning!.revision,
				fingerprint: f.data.preview!.fingerprint,
			}),
		).rejects.toThrow();
		await f.t.mutation(internal.events.planning.delivery.enqueueRendered, {
			id: f.mail._id,
			html: "<p>Invitation</p>",
		});
		await f.t.mutation(internal.events.planning.delivery.enqueueRendered, {
			id: f.mail._id,
			html: "<p>Invitation</p>",
		});
		expect(await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect())).toHaveLength(1);
	});
	it("keeps verified content unpublished until an internal approves, preserving draft edits", async () => {
		const f = await submitted();
		expect(f.confirmation.envelope.to).toBe("contact@example.com");
		expect(f.confirmation.envelope.cc).toEqual([]);
		await f.t.mutation(api.events.planning.public.submit, f.input);
		expect(await f.t.run((ctx) => ctx.db.query("eventPlanningSubmissions").collect())).toHaveLength(
			1,
		);
		expect((await f.t.run((ctx) => ctx.db.get(f.eventId)))?.title).toBe("Testarrangement");
		expect(
			await f.t.mutation(api.events.planning.public.confirm, { token: f.confirmationToken }),
		).toEqual({ state: "confirmed" });
		expect(
			await f.t.mutation(api.events.planning.public.confirm, { token: f.confirmationToken }),
		).toEqual({ state: "confirmed" });
		let review = await f.editor.query(api.events.planning.admin.get, { eventId: f.eventId });
		expect(review.event.published).toBe(false);
		expect(review.submission?.status).toBe("ready");
		await f.editor.mutation(api.events.planning.admin.saveReview, {
			submissionId: review.submission!._id,
			revision: 0,
			answers: { ...review.submission!.draft, title: "Redigert tittel" },
		});
		review = await f.editor.query(api.events.planning.admin.get, { eventId: f.eventId });
		const foodItem = await insertFoodItem(f.t);
		expect(
			await f.editor.mutation(api.events.planning.admin.approve, {
				submissionId: review.submission!._id,
				revision: 1,
				expectedEvent: review.snapshot,
				acknowledgeChanges: false,
				foodItem,
				registrationOpens: NOW + DAY_MS,
			}),
		).toEqual({ ok: true });
		const event = await f.t.run((ctx) => ctx.db.get(f.eventId));
		expect(event?.published).toBe(true);
		expect(event?.title).toBe("Redigert tittel");
		await expect(
			f.editor.mutation(api.events.planning.admin.approve, {
				submissionId: review.submission!._id,
				revision: 1,
				expectedEvent: review.snapshot,
				acknowledgeChanges: false,
				foodItem,
				registrationOpens: NOW + DAY_MS,
			}),
		).rejects.toThrow();
	});
	it("enforces package capacity server-side", async () => {
		const f = await invited();
		await expect(
			f.t.mutation(api.events.planning.public.submit, {
				token: f.token,
				revision: f.form.revision,
				submissionId: crypto.randomUUID(),
				answers: { ...f.form.answers, capacity: 41 },
			}),
		).rejects.toThrow();
	});
	it.each([
		["yes", "18"],
		["no", "none"],
		["unsure", "unsure"],
	] as const)("derives age restriction from alcohol %s", async (alcohol, ageRestriction) => {
		const f = await invited();
		await f.t.mutation(api.events.planning.public.submit, {
			token: f.token,
			revision: f.form.revision,
			submissionId: crypto.randomUUID(),
			answers: {
				...f.form.answers,
				venue: "escape",
				alcohol,
				ageRestriction: alcohol === "yes" ? "none" : "18",
			},
		});
		const submissions = await f.t.run((ctx) => ctx.db.query("eventPlanningSubmissions").collect());
		expect(submissions[0]!.answers.ageRestriction).toBe(ageRestriction);
	});
	it("exposes the main organizer email as the company contact", async () => {
		const f = await invited();
		expect(f.form.organizerEmail).toBe("lead@ifinavet.no");
	});
	it("expires confirmation links and invalidates old links on recipient correction", async () => {
		const f = await submitted();
		vi.setSystemTime(NOW + DAY_MS);
		expect(
			await f.t.mutation(api.events.planning.public.confirm, { token: f.confirmationToken }),
		).toEqual({ state: "expired" });
		const data = await f.editor.query(api.events.planning.admin.get, { eventId: f.eventId });
		await f.editor.mutation(api.events.planning.admin.savePreparation, {
			eventId: f.eventId,
			revision: data.planning!.revision,
			...f.preparation,
			contactEmail: "corrected@example.com",
		});
		expect(
			await f.t.query(api.events.planning.public.get, { token: f.token, now: NOW }),
		).toBeNull();
	});
	it("persists bounces, alerts both Slack queues and ignores late sent callbacks", async () => {
		const f = await invited();
		await f.t.run((ctx) => ctx.db.patch(f.mail._id, { status: "queued", emailId: "provider-id" }));
		await f.t.mutation(internal.feedback.delivery.messages.onEmailEvent, {
			id: "provider-id" as EmailId,
			event: {
				type: "email.bounced",
				created_at: new Date(NOW).toISOString(),
				data: {
					bounce: { message: "Invalid recipient", type: "Permanent", subType: "General" },
					email_id: "provider-id",
					from: "info@ifinavet.no",
					to: ["contact@example.com"],
					subject: "Invitation",
					created_at: new Date(NOW).toISOString(),
				},
			},
		});
		await f.t.mutation(internal.events.planning.delivery.recordProviderEvent, {
			emailId: "provider-id",
			type: "email.sent",
		});
		const mail = await f.t.run((ctx) => ctx.db.get(f.mail._id));
		expect(mail?.status).toBe("bounced");
		expect(mail?.error).toContain("avviste");
		expect(await f.t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(
			1,
		);
		expect(await f.t.run((ctx) => ctx.db.query("slackSystemDeliveries").collect())).toHaveLength(1);
		await expect(
			f.editor.mutation(api.events.planning.admin.retryEmail, { id: f.mail._id }),
		).rejects.toThrow();
	});
	it("recovers a missed delivered callback without sending a duplicate", async () => {
		const f = await invited();
		await f.t.run((ctx) =>
			ctx.db.patch(f.mail._id, { status: "sent", emailId: "provider-id", nextAttemptAt: NOW }),
		);
		vi.spyOn(trackedEmail, "status").mockResolvedValue({
			status: "delivered",
			errorMessage: null,
			bounced: false,
			complained: false,
			failed: false,
			deliveryDelayed: false,
			opened: false,
			clicked: false,
		});
		await f.t.mutation(internal.events.planning.delivery.recover, {});
		expect((await f.t.run((ctx) => ctx.db.get(f.mail._id)))?.status).toBe("delivered");
		expect(await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect())).toHaveLength(1);
	});
	it("sends as the organizer only on the configured verified domain", async () => {
		vi.stubEnv("PLANNING_VERIFIED_SENDER_DOMAIN", "ifinavet.no");
		const f = await invited();
		expect(f.mail.envelope.from).toContain("<lead@ifinavet.no>");
	});
	it("rejects confirmation of an older submission and stale internal approval", async () => {
		const f = await submitted();
		await f.t.mutation(api.events.planning.public.submit, {
			...f.input,
			submissionId: crypto.randomUUID(),
			answers: { ...f.input.answers, title: "Nyeste svar" },
		});
		expect(
			await f.t.mutation(api.events.planning.public.confirm, { token: f.confirmationToken }),
		).toEqual({ state: "invalid" });
		const emails = await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect());
		const newest = emails.filter((e) => e.kind === "confirmation").at(-1)!;
		await f.t.mutation(api.events.planning.public.confirm, { token: tokenFrom(newest.url) });
		const review = await f.editor.query(api.events.planning.admin.get, { eventId: f.eventId });
		await f.t.run((ctx) => ctx.db.patch(f.eventId, { title: "Endret av en annen arrangør" }));
		const foodItem = await insertFoodItem(f.t);
		await expect(
			f.editor.mutation(api.events.planning.admin.approve, {
				submissionId: review.submission!._id,
				revision: 0,
				expectedEvent: review.snapshot,
				acknowledgeChanges: true,
				foodItem,
				registrationOpens: NOW + DAY_MS,
			}),
		).rejects.toThrow();
		expect((await f.t.run((ctx) => ctx.db.get(f.eventId)))?.published).toBe(false);
	});
	it("cancels and alerts when organizers change after send approval", async () => {
		const f = await invited();
		await f.t.run(async (ctx) => {
			const organizers = await ctx.db
				.query("eventOrganizers")
				.withIndex("by_eventId", (q) => q.eq("eventId", f.eventId))
				.collect();
			await ctx.db.delete(organizers[0]!._id);
		});
		await f.t.mutation(internal.events.planning.delivery.enqueueRendered, {
			id: f.mail._id,
			html: "<p>Invitation</p>",
		});
		expect((await f.t.run((ctx) => ctx.db.get(f.mail._id)))?.status).toBe("cancelled");
		expect(await f.t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(
			1,
		);
	});
	it("allows only one explicit retry of a failed invitation", async () => {
		const f = await invited();
		await f.t.run((ctx) => ctx.db.patch(f.mail._id, { status: "failed", error: "Provider error" }));
		await f.editor.mutation(api.events.planning.admin.retryEmail, { id: f.mail._id });
		await expect(
			f.editor.mutation(api.events.planning.admin.retryEmail, { id: f.mail._id }),
		).rejects.toThrow();
		expect(await f.t.run((ctx) => ctx.db.query("eventPlanningEmails").collect())).toHaveLength(2);
	});
	it("alerts again if a delayed message subsequently bounces", async () => {
		const f = await invited();
		await f.t.run((ctx) => ctx.db.patch(f.mail._id, { status: "queued", emailId: "provider-id" }));
		await f.t.mutation(internal.events.planning.delivery.recordProviderEvent, {
			emailId: "provider-id",
			type: "email.delivery_delayed",
		});
		await f.t.mutation(internal.events.planning.delivery.recordProviderEvent, {
			emailId: "provider-id",
			type: "email.bounced",
		});
		expect(await f.t.run((ctx) => ctx.db.query("eventSlackNotifications").collect())).toHaveLength(
			2,
		);
		expect((await f.t.run((ctx) => ctx.db.get(f.mail._id)))?.status).toBe("bounced");
	});
});
