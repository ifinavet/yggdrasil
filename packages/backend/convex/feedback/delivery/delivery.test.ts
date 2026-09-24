import type { EmailEvent, EmailId } from "@convex-dev/resend";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { featureFlags } from "@workspace/shared/feature-flags";
import { feedbackOpensAt, feedbackRoundAt } from "@workspace/shared/feedback/time";
import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertOrganizer,
	insertRegistration,
	insertUser,
	setup,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import { hashLinkToken } from "../../lib/tokens";
import { syncFeedbackCampaign } from "./campaigns";
import { cancelInvitationEmails, feedbackResend } from "./messages";

const campaigns = internal.feedback.delivery.campaigns;
const messages = internal.feedback.delivery.messages;
const send = internal.feedback.delivery.mail.sendFeedbackEmail;
const opensAt = Date.UTC(2026, 8, 23, 6);
const token = "a".repeat(43);
const url = `${HUGIN_LOCAL_URL}/feedback#token=${token}`;

async function fixture() {
	const { t, companyId } = await setup();
	const user = await insertUser(t, "feedback@example.test");
	await grantRole(t, user._id, "super-admin");
	const client = asUser(t, user);
	const formId = await client.mutation(api.feedback.forms.mutations.saveDraft, {
		name: "Feedback",
		fields: [{ key: "rating", type: "rating", label: "Hvordan var det?", required: true }],
	});
	const versionId = await client.mutation(api.feedback.forms.mutations.publish, { formId });
	await client.mutation(api.feedback.forms.mutations.setDefault, { formId });
	const eventId = await insertEvent(t, companyId, {
		eventStart: Date.UTC(2026, 8, 22, 16),
		feedbackEnabled: true,
	});
	const registrationId = await insertRegistration(t, eventId, user._id, "registered");
	await t.run((ctx) => ctx.db.patch(registrationId, { attendanceStatus: "confirmed" }));
	const campaignId = await t.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			status: "open",
			formVersionId: versionId,
			generation: 1,
			opensAt,
			closesAt: feedbackRoundAt(opensAt, 14),
		}),
	);
	const inviteId = await t.run((ctx) =>
		ctx.db.insert("feedbackInvites", {
			campaignId,
			userId: user._id,
			registrationId,
			responded: false,
			bounced: false,
			complained: false,
			sent: false,
			delivered: false,
		}),
	);
	const args = { inviteId, generation: 1, round: 0 as const };
	const email = { ...args, token, url, html: "<p>Feedback</p>", subject: "Feedback" };
	return {
		t,
		client,
		user,
		formId,
		versionId,
		eventId,
		registrationId,
		campaignId,
		inviteId,
		args,
		email,
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(opensAt);
	featureFlags.huginFeedback.emailsEnabled = true;
	vi.stubEnv("APP_ENV", "local");
	vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
});
afterEach(() => {
	featureFlags.huginFeedback.emailsEnabled = false;
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

async function eventCallback(
	type: EmailEvent["type"],
	id: string,
): Promise<{ id: EmailId; event: EmailEvent }> {
	const data = {
		email_id: id,
		created_at: new Date().toISOString(),
		from: "info@ifinavet.no",
		to: ["feedback@example.test"],
		subject: "Feedback",
	};
	if (type === "email.bounced")
		Object.assign(data, {
			bounce: { message: "Undeliverable", subType: "General", type: "Permanent" },
		});
	return {
		id: id as EmailId,
		event: { type, created_at: new Date().toISOString(), data } as EmailEvent,
	};
}

describe("feedback delivery", () => {
	it("captures a rendered invitation locally and resolves the real fragment token", async () => {
		const { t, args } = await fixture();
		await t.action(send, args);
		const captures = await t.run((ctx) => ctx.db.query("feedbackLocalEmails").collect());
		expect(captures).toHaveLength(1);
		const capture = captures[0];
		expect(capture).toBeDefined();
		if (!capture) throw new Error("Expected captured email");
		expect(capture.subject).toBe("Tilbakemelding: Testarrangement");
		expect(capture.html).toContain("Gi tilbakemelding");
		expect(capture.html).toContain("bedriftspresentasjonen med Testbedrift!");
		const link = new URL(capture.url);
		expect(link.pathname).toBe("/feedback");
		expect(link.search).toBe("");
		const plainToken = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
		expect(
			await t.action(api.feedback.responses.actions.resolveFeedbackToken, { token: plainToken }),
		).toMatchObject({ status: "open", form: { name: "Feedback" } });
		expect(await t.run((ctx) => ctx.db.query("feedbackTokens").collect())).toMatchObject([
			{ tokenHash: await hashLinkToken(plainToken) },
		]);
		await t.action(send, args);
		expect(await t.run((ctx) => ctx.db.query("feedbackLocalEmails").collect())).toHaveLength(1);
		expect(await t.run((ctx) => ctx.db.query("feedbackTokens").collect())).toHaveLength(1);
	});
	it("does not render or queue mail with the master flag disabled", async () => {
		const { t, args, email } = await fixture();
		featureFlags.huginFeedback.emailsEnabled = false;
		await t.action(send, args);
		expect(await t.mutation(messages.enqueueEmail, email)).toBeNull();
		expect(await t.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toEqual([]);
	});
	it("signs with Navet's arrangement address when the event has no lead organizer", async () => {
		const { t, args, eventId } = await fixture();
		const helper = await insertUser(t, "helper@ifinavet.no", { firstName: "Mia" });
		await t.run((ctx) =>
			ctx.db.insert("eventOrganizers", { eventId, userId: helper._id, role: "medhjelper" }),
		);
		expect(await t.query(messages.prepareEmail, { ...args, now: opensAt })).toMatchObject({
			companyName: "Testbedrift",
			signature: { name: "Navet", email: "arrangement@ifinavet.no" },
		});
	});
	it("signs with the lead organizer's name and email", async () => {
		const { t, args, eventId } = await fixture();
		const lead = await insertUser(t, "ola.nordmann@ifinavet.no", {
			firstName: "Ola",
			lastName: "Nordmann",
		});
		await insertOrganizer(t, eventId, lead._id);
		await t.action(send, args);
		const [capture] = await t.run((ctx) => ctx.db.query("feedbackLocalEmails").collect());
		expect(capture?.html).toContain("Ola Nordmann");
		expect(capture?.html).toContain("mailto:ola.nordmann@ifinavet.no");
	});
	it("does not prepare mail once the hosting company is deleted", async () => {
		const { t, args, eventId } = await fixture();
		await t.run(async (ctx) => {
			const event = await ctx.db.get(eventId);
			if (event) await ctx.db.delete(event.hostingCompany);
		});
		expect(await t.query(messages.prepareEmail, { ...args, now: opensAt })).toBeNull();
	});
	it("rechecks flags and answers after rendering, before enqueue", async () => {
		const { t, args, email, eventId, inviteId } = await fixture();
		expect(await t.query(messages.prepareEmail, { ...args, now: opensAt })).not.toBeNull();
		await t.run((ctx) => ctx.db.patch(eventId, { feedbackEnabled: false }));
		expect(await t.mutation(messages.enqueueEmail, email)).toBeNull();
		await t.run(async (ctx) => {
			await ctx.db.patch(eventId, { feedbackEnabled: true });
			await ctx.db.patch(inviteId, { responded: true });
		});
		expect(await t.mutation(messages.enqueueEmail, email)).toBeNull();
	});
	it.each(["responded", "bounced", "complained"] as const)(
		"suppresses %s invitations",
		async (field) => {
			const { t, args, inviteId } = await fixture();
			await t.run((ctx) => ctx.db.patch(inviteId, { [field]: true }));
			await t.action(send, args);
			expect(await t.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toEqual([]);
		},
	);
	it.each([
		"missingInvite",
		"missingUserId",
		"retainedInvite",
		"missingCampaign",
		"retainedCampaign",
		"closedCampaign",
		"missingVersion",
		"staleGeneration",
		"beforeDue",
		"afterClose",
		"missingEvent",
		"disabledEvent",
		"unpublishedEvent",
		"externalEvent",
		"missingUser",
		"existingResponse",
	])("fails closed for %s", async (scenario) => {
		const f = await fixture();
		await f.t.run(async (ctx) => {
			switch (scenario) {
				case "missingInvite":
					await ctx.db.delete(f.inviteId);
					break;
				case "missingUserId":
					await ctx.db.patch(f.inviteId, { userId: undefined });
					break;
				case "retainedInvite":
					await ctx.db.patch(f.inviteId, { retainedAt: opensAt });
					break;
				case "missingCampaign":
					await ctx.db.delete(f.campaignId);
					break;
				case "retainedCampaign":
					await ctx.db.patch(f.campaignId, { retainedAt: opensAt });
					break;
				case "closedCampaign":
					await ctx.db.patch(f.campaignId, { status: "closed" });
					break;
				case "missingVersion":
					await ctx.db.patch(f.campaignId, { formVersionId: undefined });
					break;
				case "staleGeneration":
					await ctx.db.patch(f.campaignId, { generation: 2 });
					break;
				case "beforeDue":
					vi.setSystemTime(opensAt - 1);
					break;
				case "afterClose":
					vi.setSystemTime(feedbackRoundAt(opensAt, 14));
					break;
				case "missingEvent":
					await ctx.db.delete(f.eventId);
					break;
				case "disabledEvent":
					await ctx.db.patch(f.eventId, { feedbackEnabled: false });
					break;
				case "unpublishedEvent":
					await ctx.db.patch(f.eventId, { published: false });
					break;
				case "externalEvent":
					await ctx.db.patch(f.eventId, { externalEvent: true });
					break;
				case "missingUser":
					await ctx.db.delete(f.user._id);
					break;
				case "existingResponse":
					await ctx.db.insert("formResponses", {
						campaignId: f.campaignId,
						formVersionId: f.versionId,
						inviteId: f.inviteId,
						data: { rating: 5 },
						submittedAt: opensAt,
					});
					break;
			}
		});
		expect(await f.t.mutation(messages.enqueueEmail, f.email)).toBeNull();
	});
	it("rejects malformed rounds and tokens without creating a delivery", async () => {
		const { t, email } = await fixture();
		await expect(t.mutation(messages.enqueueEmail, { ...email, token: "short" })).rejects.toThrow();
		await expect(t.mutation(messages.enqueueEmail, { ...email, round: 1 as 0 })).rejects.toThrow();
		expect(await t.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toEqual([]);
	});
	it("sends each reminder once, stops after submission, and accepts older links", async () => {
		const { t, args } = await fixture();
		for (const round of [0, 3, 7] as const) {
			vi.setSystemTime(feedbackRoundAt(opensAt, round));
			await t.action(send, { ...args, round });
		}
		const captures = await t.run((ctx) => ctx.db.query("feedbackLocalEmails").collect());
		expect(captures).toHaveLength(3);
		expect(captures[1]?.subject).toContain("Påminnelse");
		const firstToken =
			new URLSearchParams(new URL(captures[0]?.url ?? "").hash.slice(1)).get("token") ?? "";
		expect(
			await t.mutation(api.feedback.responses.mutations.submitFeedbackResponse, {
				token: firstToken,
				answers: { rating: 5 },
			}),
		).toEqual({ status: "submitted" });
		vi.setSystemTime(feedbackRoundAt(opensAt, 11));
		await t.action(send, { ...args, round: 11 });
		expect(await t.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toHaveLength(3);
	});
	it("uses the deployed Hugin URL outside local development", async () => {
		const { t, args } = await fixture();
		vi.stubEnv("APP_ENV", "test");
		feedbackResend.config.apiKey = "re_test";
		await t.action(send, args);
		const deliveries = await t.run((ctx) => ctx.db.query("feedbackDeliveries").collect());
		const emailId = deliveries[0]?.emailId as EmailId;
		const email = await t.run((ctx) => feedbackResend.get(ctx, emailId));
		expect(email).toMatchObject({ status: "waiting" });
		expect(email?.html).toContain(`${HUGIN_URL}/feedback#token=`);
	});
	it("queues through the real Resend component atomically and cancels waiting mail", async () => {
		const { t, email, inviteId, campaignId } = await fixture();
		vi.stubEnv("APP_ENV", "test");
		feedbackResend.config.apiKey = "re_test";
		const id = (await t.mutation(messages.enqueueEmail, email)) as EmailId;
		expect(await t.run((ctx) => feedbackResend.status(ctx, id))).toMatchObject({
			status: "waiting",
		});
		expect(await t.run((ctx) => ctx.db.query("feedbackLocalEmails").collect())).toEqual([]);
		expect(await t.mutation(messages.enqueueEmail, email)).toBe(id);
		await t.mutation(messages.cancelCampaignEmails, { campaignId, cursor: null });
		expect(await t.run((ctx) => feedbackResend.status(ctx, id))).toMatchObject({
			status: "cancelled",
		});
		await t.run((ctx) => cancelInvitationEmails(ctx, inviteId));
	});
	it("handles duplicate and out-of-order callbacks without clearing delivery flags", async () => {
		const { t, email, inviteId } = await fixture();
		const id = (await t.mutation(messages.enqueueEmail, email)) ?? "";
		for (const type of [
			"email.delivered",
			"email.sent",
			"email.bounced",
			"email.complained",
			"email.delivered",
			"email.delivery_delayed",
		] as const)
			await t.mutation(messages.onEmailEvent, await eventCallback(type, id));
		expect(await t.run((ctx) => ctx.db.get(inviteId))).toMatchObject({
			sent: true,
			delivered: true,
			bounced: true,
			complained: true,
		});
		await t.mutation(messages.onEmailEvent, await eventCallback("email.sent", "unknown"));
		await t.run((ctx) => ctx.db.delete(inviteId));
		await t.mutation(messages.onEmailEvent, await eventCallback("email.sent", id));
	});
});

describe("campaign lifecycle", () => {
	it("schedules next morning in Oslo, reschedules before opening, and ignores stale jobs", async () => {
		const f = await fixture();
		await f.t.run((ctx) => ctx.db.delete(f.campaignId));
		vi.setSystemTime(opensAt - 86400000);
		await f.client.mutation(api.feedback.events.updateEventFeedbackSettings, {
			eventId: f.eventId,
			enabled: true,
		});
		const original = await f.t.run((ctx) => ctx.db.query("feedbackCampaigns").first());
		if (!original) throw new Error("Expected scheduled campaign");
		expect(original).toMatchObject({
			status: "scheduled",
			opensAt,
			closesAt: feedbackRoundAt(opensAt, 14),
			generation: 1,
		});
		await f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId));
		expect(await f.t.run((ctx) => ctx.db.get(original._id))).toEqual(original);
		await f.t.run(async (ctx) => {
			await ctx.db.patch(f.eventId, { eventStart: opensAt });
			await syncFeedbackCampaign(ctx, f.eventId);
		});
		const updated = await f.t.run((ctx) => ctx.db.get(original._id));
		if (!updated) throw new Error("Expected rescheduled campaign");
		expect(updated.generation).toBe(2);
		expect(updated.opensAt).toBe(feedbackOpensAt(opensAt));
		expect(
			await f.t.mutation(campaigns.openCampaign, { campaignId: original._id, generation: 1 }),
		).toBe(false);
		expect(
			await f.t.mutation(campaigns.openCampaign, { campaignId: original._id, generation: 2 }),
		).toBe(false);
		vi.setSystemTime(updated.opensAt);
		expect(
			await f.t.mutation(campaigns.openCampaign, { campaignId: original._id, generation: 2 }),
		).toBe(true);
		expect(
			await f.t.mutation(campaigns.openCampaign, { campaignId: original._id, generation: 2 }),
		).toBe(false);
		expect(await f.t.run((ctx) => ctx.db.get(original._id))).toMatchObject({
			status: "open",
			formVersionId: f.versionId,
		});
		await f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId));
		await f.t.mutation(campaigns.closeCampaign, { campaignId: original._id, generation: 2 });
		expect(await f.t.run((ctx) => ctx.db.get(original._id))).toMatchObject({ status: "open" });
		vi.setSystemTime(updated.closesAt);
		await f.t.mutation(campaigns.closeCampaign, { campaignId: original._id, generation: 1 });
		await f.t.mutation(campaigns.closeCampaign, { campaignId: original._id, generation: 2 });
		expect(await f.t.run((ctx) => ctx.db.get(original._id))).toMatchObject({
			status: "closed",
			closedAt: updated.closesAt,
		});
		await f.t.mutation(campaigns.closeCampaign, { campaignId: original._id, generation: 2 });
	});
	it.each(["missing", "cancelled", "closed"] as const)(
		"allows ordinary edits and bulk publication of past events with a %s campaign",
		async (status) => {
			const f = await fixture();
			await f.t.run(async (ctx) => {
				if (status === "missing") await ctx.db.delete(f.campaignId);
				else await ctx.db.patch(f.campaignId, { status, formVersionId: undefined });
			});
			const event = await f.t.run((ctx) => ctx.db.get(f.eventId));
			if (!event) throw new Error("Expected event");
			const { _id, _creationTime, slug, feedbackEnabled, ...eventFields } = event;
			await f.client.mutation(api.events.mutations.update, {
				...eventFields,
				id: f.eventId,
				title: "Updated past event",
				organizers: [],
			});
			const otherEventId = await insertEvent(f.t, event.hostingCompany, { published: false });
			await f.client.mutation(api.events.mutations.updatePublishedStatus, {
				ids: [otherEventId, f.eventId],
				newPublishedStatus: true,
			});
			expect(await f.t.run((ctx) => ctx.db.get(f.eventId))).toMatchObject({
				title: "Updated past event",
				published: true,
			});
			expect(await f.t.run((ctx) => ctx.db.get(otherEventId))).toMatchObject({ published: true });
			const campaign = await f.t.run((ctx) => ctx.db.get(f.campaignId));
			if (status === "missing") expect(campaign).toBeNull();
			else expect(campaign?.status).toBe(status);
			expect(await f.t.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toEqual([]);
		},
	);
	it.each(["past", "unpublishedForm"] as const)(
		"skips invalid passive scheduling: %s",
		async (reason) => {
			const f = await fixture();
			await f.t.run((ctx) => ctx.db.delete(f.campaignId));
			if (reason === "unpublishedForm") {
				vi.setSystemTime(opensAt - 86400000);
				await f.t.run((ctx) => ctx.db.delete(f.versionId));
			}
			await f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId));
			expect(await f.t.run((ctx) => ctx.db.query("feedbackCampaigns").collect())).toEqual([]);
			const scheduledId = await f.t.run((ctx) =>
				ctx.db.insert("feedbackCampaigns", {
					eventId: f.eventId,
					status: "scheduled",
					generation: 1,
					opensAt: opensAt + 86400000,
					closesAt: feedbackRoundAt(opensAt, 15),
				}),
			);
			await f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId));
			expect(await f.t.run((ctx) => ctx.db.get(scheduledId))).toMatchObject({
				status: "cancelled",
			});
		},
	);
	it("rejects explicit activation of a past event without saving the flag", async () => {
		const f = await fixture();
		await f.t.run(async (ctx) => {
			await ctx.db.delete(f.campaignId);
			await ctx.db.patch(f.eventId, { feedbackEnabled: false });
		});
		await expect(
			f.client.mutation(api.feedback.events.updateEventFeedbackSettings, {
				eventId: f.eventId,
				enabled: true,
			}),
		).rejects.toThrow("utsendelsestidspunktet");
		expect(await f.t.run((ctx) => ctx.db.get(f.eventId))).toMatchObject({ feedbackEnabled: false });
	});
	it("never sends historical campaigns automatically and requires a published form", async () => {
		const f = await fixture();
		await f.t.run((ctx) => ctx.db.delete(f.campaignId));
		await expect(
			f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId, { requireSchedule: true })),
		).rejects.toThrow("utsendelsestidspunktet");
		vi.setSystemTime(opensAt - 86400000);
		await f.t.run((ctx) => ctx.db.delete(f.versionId));
		await expect(
			f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId, { requireSchedule: true })),
		).rejects.toThrow("Publiser");
		await f.t.run((ctx) => ctx.db.delete(f.eventId));
		await expect(
			f.t.run((ctx) => syncFeedbackCampaign(ctx, f.eventId, { requireSchedule: true })),
		).rejects.toThrow("finnes ikke");
	});
	it.each(["disabled", "unpublished", "external"])(
		"cancels on %s and re-enables only an unopened campaign",
		async (reason) => {
			const f = await fixture();
			await f.t.run((ctx) =>
				ctx.db.patch(f.campaignId, { status: "scheduled", formVersionId: undefined }),
			);
			vi.setSystemTime(opensAt - 86400000);
			const patch =
				reason === "disabled"
					? { feedbackEnabled: false }
					: reason === "unpublished"
						? { published: false }
						: { externalEvent: true };
			await f.t.run(async (ctx) => {
				await ctx.db.patch(f.eventId, patch);
				await syncFeedbackCampaign(ctx, f.eventId);
			});
			expect(await f.t.run((ctx) => ctx.db.get(f.campaignId))).toMatchObject({
				status: "cancelled",
			});
			await f.t.run(async (ctx) => {
				await ctx.db.patch(f.eventId, {
					feedbackEnabled: true,
					published: true,
					externalEvent: false,
				});
				await syncFeedbackCampaign(ctx, f.eventId);
			});
			expect(await f.t.run((ctx) => ctx.db.get(f.campaignId))).toMatchObject({
				status: "scheduled",
				generation: 2,
			});
		},
	);
	it.each([
		"missing",
		"expired",
		"missingEvent",
		"disabled",
		"unpublished",
		"external",
		"missingForm",
	])("does not open %s campaigns", async (reason) => {
		const f = await fixture();
		await f.t.run((ctx) =>
			ctx.db.patch(f.campaignId, { status: "scheduled", formVersionId: undefined }),
		);
		await f.t.run(async (ctx) => {
			if (reason === "missing") await ctx.db.delete(f.campaignId);
			if (reason === "expired") vi.setSystemTime(feedbackRoundAt(opensAt, 14));
			if (reason === "missingEvent") await ctx.db.delete(f.eventId);
			if (reason === "disabled") await ctx.db.patch(f.eventId, { feedbackEnabled: false });
			if (reason === "unpublished") await ctx.db.patch(f.eventId, { published: false });
			if (reason === "external") await ctx.db.patch(f.eventId, { externalEvent: true });
			if (reason === "missingForm") await ctx.db.delete(f.formId);
		});
		expect(
			await f.t.mutation(campaigns.openCampaign, { campaignId: f.campaignId, generation: 1 }),
		).toBe(false);
		await f.t.mutation(campaigns.closeCampaign, { campaignId: f.campaignId, generation: 1 });
	});
	it("invites only attended registered participants, once, excluding organizers", async () => {
		const f = await fixture();
		for (const kind of [
			"confirmed",
			"late",
			"no_show",
			"pending",
			"waitlist",
			"unmarked",
			"organizer",
			"deleted",
		] as const) {
			const user = await insertUser(f.t, `${kind}@example.test`);
			const registration = await insertRegistration(
				f.t,
				f.eventId,
				user._id,
				kind === "pending" || kind === "waitlist" ? kind : "registered",
			);
			if (kind !== "unmarked")
				await f.t.run((ctx) =>
					ctx.db.patch(registration, {
						attendanceStatus:
							kind === "no_show" ? "no_show" : kind === "late" ? "late" : "confirmed",
					}),
				);
			if (kind === "organizer") await insertOrganizer(f.t, f.eventId, user._id);
			if (kind === "deleted") await f.t.run((ctx) => ctx.db.delete(user._id));
		}
		const args = { campaignId: f.campaignId, generation: 1, cursor: null };
		expect(await f.t.mutation(campaigns.inviteParticipants, args)).toBeNull();
		await f.t.mutation(campaigns.inviteParticipants, args);
		expect(await f.t.run((ctx) => ctx.db.query("feedbackInvites").collect())).toHaveLength(3);
	});
	it.each(["missing", "stale", "closed", "expired", "disabled", "unpublished", "external"])(
		"stops participant pagination for %s",
		async (reason) => {
			const f = await fixture();
			await f.t.run(async (ctx) => {
				if (reason === "missing") await ctx.db.delete(f.campaignId);
				if (reason === "stale") await ctx.db.patch(f.campaignId, { generation: 2 });
				if (reason === "closed") await ctx.db.patch(f.campaignId, { status: "closed" });
				if (reason === "expired") vi.setSystemTime(feedbackRoundAt(opensAt, 14));
				if (reason === "disabled") await ctx.db.patch(f.eventId, { feedbackEnabled: false });
				if (reason === "unpublished") await ctx.db.patch(f.eventId, { published: false });
				if (reason === "external") await ctx.db.patch(f.eventId, { externalEvent: true });
			});
			expect(
				await f.t.mutation(campaigns.inviteParticipants, {
					campaignId: f.campaignId,
					generation: 1,
					cursor: null,
				}),
			).toBeNull();
		},
	);
	it("keeps Oslo clock time over daylight-saving changes", () => {
		const beforeDst = Date.parse("2026-10-24T08:00:00+02:00");
		expect(new Date(feedbackRoundAt(beforeDst, 3)).toISOString()).toBe("2026-10-27T07:00:00.000Z");
	});
});

describe("durable workflow integration", () => {
	it.each([true, false])(
		"runs the real campaign workflow with event enabled=%s",
		async (enabled) => {
			const f = await fixture();
			await f.t.run(async (ctx) => {
				await ctx.db.patch(f.campaignId, { status: "scheduled", formVersionId: undefined });
				await ctx.db.patch(f.eventId, { feedbackEnabled: enabled });
				await ctx.db.delete(f.inviteId);
			});
			await f.t.mutation(internal.feedback.delivery.workflows.campaignV1, {
				args: {
					campaignId: f.campaignId,
					generation: 1,
					opensAt,
					closesAt: feedbackRoundAt(opensAt, 14),
				},
			});
			await f.t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer(), 500);
			const deliveries = await f.t.run((ctx) => ctx.db.query("feedbackDeliveries").collect());
			expect(deliveries.map((delivery) => delivery.round)).toEqual(enabled ? [0, 3, 7, 11] : []);
			expect(await f.t.run((ctx) => ctx.db.get(f.campaignId))).toMatchObject({
				status: enabled ? "closed" : "cancelled",
			});
		},
		20000,
	);
	it("continues bounded invitation and cancellation batches", async () => {
		const f = await fixture();
		for (let index = 0; index < 51; index++) {
			const user = await insertUser(f.t, `batch-${index}@example.test`);
			await insertRegistration(f.t, f.eventId, user._id, "registered");
			await f.t.run((ctx) =>
				ctx.db.insert("feedbackInvites", {
					campaignId: f.campaignId,
					userId: user._id,
					responded: false,
					bounced: false,
					complained: false,
					sent: false,
					delivered: false,
				}),
			);
		}
		const cursor = await f.t.mutation(campaigns.inviteParticipants, {
			campaignId: f.campaignId,
			generation: 1,
			cursor: null,
		});
		expect(cursor).not.toBeNull();
		expect(
			await f.t.mutation(campaigns.inviteParticipants, {
				campaignId: f.campaignId,
				generation: 1,
				cursor,
			}),
		).toBeNull();
		await f.t.mutation(messages.cancelCampaignEmails, { campaignId: f.campaignId, cursor: null });
		await f.t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer());
		const scheduled = await f.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled.filter((job) => job.name.endsWith("cancelCampaignEmails"))).toHaveLength(2);
		expect(scheduled.every((job) => job.state.kind === "success")).toBe(true);
	});
});

describe("feedback email webhook", () => {
	it("verifies signatures through the real HTTP route", async () => {
		const { t } = await fixture();
		const secret = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
		feedbackResend.config.webhookSecret = secret;
		const event = await eventCallback("email.sent", "unrelated-email");
		const body = JSON.stringify(event.event);
		const headers = {
			"svix-id": "msg_feedback",
			"svix-timestamp": String(opensAt / 1000),
			"svix-signature": new Webhook(secret).sign("msg_feedback", new Date(opensAt), body),
		};
		expect((await t.fetch("/resend-webhook", { method: "POST", body, headers })).status).toBe(201);
		expect((await t.fetch("/resend-webhook", { method: "POST", body })).status).toBe(400);
		expect(
			(await t.fetch("/resend-webhook", { method: "POST", body: `${body} `, headers })).status,
		).toBe(400);
		feedbackResend.config.webhookSecret = "";
		await expect(t.fetch("/resend-webhook", { method: "POST", body, headers })).rejects.toThrow(
			"Webhook secret",
		);
	});
});

it("cancels feedback through the existing publish-status mutation", async () => {
	const f = await fixture();
	await f.client.mutation(api.events.mutations.updatePublishedStatus, {
		ids: [f.eventId],
		newPublishedStatus: false,
	});
	expect(await f.t.run((ctx) => ctx.db.get(f.campaignId))).toMatchObject({ status: "cancelled" });
	await f.t.action(send, f.args);
	expect(await f.t.run((ctx) => ctx.db.query("feedbackDeliveries").collect())).toEqual([]);
});
