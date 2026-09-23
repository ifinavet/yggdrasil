import type { FeedbackAnswers } from "@workspace/shared/feedback";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asUser, grantRole, insertEvent, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";
import { hashLinkToken } from "../../lib/tokens";
import { defaultFeedbackFields } from "../defaultFields";

const resolveToken = api.feedback.responses.actions.resolveFeedbackToken;
const submitResponse = api.feedback.responses.mutations.submitFeedbackResponse;
const formMutations = api.feedback.forms.mutations;
const now = Date.UTC(2026, 8, 23, 10);
const token = "a".repeat(64);
const answers = {
	satisfaction: 5,
	impression: 4,
	expectation: 3,
	toughts: "Bra",
	improvements: "Mer tid",
	want_to_work: "ja",
	word_of_mouth: ["Ifinavet.no"],
	other: "",
};

async function setupTokenFeedback() {
	const { t: backend, companyId } = await setup();
	const recipient = await insertUser(backend, "recipient@example.test");
	const publisher = await insertUser(backend, "publisher@example.test");
	await grantRole(backend, publisher._id, "super-admin");
	const publisherClient = asUser(backend, publisher);
	const formId = await publisherClient.mutation(formMutations.saveDraft, {
		name: "Feedback",
		fields: defaultFeedbackFields,
	});
	const versionId = await publisherClient.mutation(formMutations.publish, { formId });
	const eventId = await insertEvent(backend, companyId, {
		feedbackEnabled: true,
		feedbackFormId: formId,
	});
	const campaignId = await backend.run((ctx) =>
		ctx.db.insert("feedbackCampaigns", {
			eventId,
			formVersionId: versionId,
			status: "open",
			opensAt: now - 1000,
			closesAt: now + 60000,
			generation: 1,
		}),
	);
	const inviteId = await backend.run((ctx) =>
		ctx.db.insert("feedbackInvites", {
			campaignId,
			userId: recipient._id,
			responded: false,
			bounced: false,
			complained: false,
			delivered: false,
			sent: false,
		}),
	);
	const deliveryId = await backend.run((ctx) =>
		ctx.db.insert("feedbackDeliveries", {
			campaignId,
			inviteId,
			round: 0,
			emailId: "local:test-email",
			queuedAt: now,
		}),
	);
	const tokenHash = await hashLinkToken(token);
	const tokenId = await backend.run((ctx) =>
		ctx.db.insert("feedbackTokens", { inviteId, deliveryId, tokenHash }),
	);
	return {
		backend,
		publisherClient,
		recipient,
		formId,
		versionId,
		eventId,
		campaignId,
		inviteId,
		deliveryId,
		tokenId,
	};
}

describe("public token feedback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});
	afterEach(() => vi.useRealTimers());
	it("resolves without login, exposes only form details, and never writes on reads", async () => {
		const { backend, eventId, inviteId, deliveryId } = await setupTokenFeedback();
		const event = await backend.run((ctx) => ctx.db.get(eventId));
		const inviteBefore = await backend.run((ctx) => ctx.db.get(inviteId));
		const deliveryBefore = await backend.run((ctx) => ctx.db.get(deliveryId));
		const expected = {
			status: "open",
			event: { title: event?.title, eventStart: event?.eventStart },
			form: { name: "Feedback", fields: defaultFeedbackFields },
			closesAt: now + 60000,
		};
		expect(await backend.action(resolveToken, { token })).toEqual(expected);
		expect(await backend.action(resolveToken, { token })).toEqual(expected);
		expect(await backend.run((ctx) => ctx.db.get(inviteId))).toEqual(inviteBefore);
		expect(await backend.run((ctx) => ctx.db.get(deliveryId))).toEqual(deliveryBefore);
		expect(await backend.run((ctx) => ctx.db.query("formResponses").collect())).toEqual([]);
		expect(
			await backend.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()),
		).toEqual([]);
	});
	it("stores one attributed response without trusting the signed-in identity", async () => {
		const { backend, publisherClient, versionId, campaignId, inviteId, recipient } =
			await setupTokenFeedback();
		expect(await publisherClient.mutation(submitResponse, { token, answers })).toEqual({
			status: "submitted",
		});
		const storedResponses = await backend.run((ctx) => ctx.db.query("formResponses").collect());
		expect(storedResponses).toHaveLength(1);
		expect(storedResponses[0]).toMatchObject({
			campaignId,
			formVersionId: versionId,
			inviteId,
			data: answers,
			submittedAt: now,
		});
		expect(await backend.run((ctx) => ctx.db.get(inviteId))).toMatchObject({
			responded: true,
			userId: recipient._id,
		});
		expect(await backend.action(resolveToken, { token })).toEqual({ status: "already-submitted" });
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "already-submitted",
		});
	});
	it("supports signed-out submission", async () => {
		const { backend } = await setupTokenFeedback();
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "submitted",
		});
	});
	it.each(["", "short", "x".repeat(257), "unknown".repeat(10)])(
		"rejects invalid tokens on reads and writes: %s",
		async (invalidToken) => {
			const { backend } = await setupTokenFeedback();
			expect(await backend.action(resolveToken, { token: invalidToken })).toEqual({
				status: "invalid",
			});
			expect(await backend.mutation(submitResponse, { token: invalidToken, answers })).toEqual({
				status: "invalid",
			});
			expect(await backend.run((ctx) => ctx.db.query("formResponses").collect())).toEqual([]);
		},
	);
	it.each([false, undefined])(
		"enforces the event flag when it is %s, including after the form was opened",
		async (enabled) => {
			const { backend, eventId } = await setupTokenFeedback();
			expect((await backend.action(resolveToken, { token })).status).toBe("open");
			await backend.run((ctx) => ctx.db.patch(eventId, { feedbackEnabled: enabled }));
			expect(await backend.action(resolveToken, { token })).toEqual({ status: "unavailable" });
			expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
				status: "unavailable",
			});
		},
	);
	it.each(["scheduled", "closed", "cancelled"] as const)(
		"enforces campaign status %s on reads and writes",
		async (status) => {
			const { backend, campaignId } = await setupTokenFeedback();
			await backend.run((ctx) => ctx.db.patch(campaignId, { status }));
			const expected = { status: status === "scheduled" ? "not-open" : "closed" };
			expect(await backend.action(resolveToken, { token })).toEqual(expected);
			expect(await backend.mutation(submitResponse, { token, answers })).toEqual(expected);
		},
	);
	it("enforces the opening boundary using server time", async () => {
		const { backend, campaignId } = await setupTokenFeedback();
		await backend.run((ctx) => ctx.db.patch(campaignId, { opensAt: now + 1 }));
		expect(await backend.action(resolveToken, { token })).toEqual({ status: "not-open" });
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "not-open",
		});
		vi.setSystemTime(now + 1);
		expect((await backend.action(resolveToken, { token })).status).toBe("open");
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "submitted",
		});
	});
	it("rejects a form opened before expiry when submitted at the closing boundary", async () => {
		const { backend } = await setupTokenFeedback();
		vi.setSystemTime(now + 59999);
		expect((await backend.action(resolveToken, { token })).status).toBe("open");
		vi.setSystemTime(now + 60000);
		expect(await backend.action(resolveToken, { token })).toEqual({ status: "closed" });
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "closed",
		});
		expect(await backend.run((ctx) => ctx.db.query("formResponses").collect())).toEqual([]);
	});
	it.each(["token", "invite", "campaign", "event", "version"] as const)(
		"fails closed for a deleted %s",
		async (missing) => {
			const { backend, tokenId, inviteId, campaignId, eventId, versionId } =
				await setupTokenFeedback();
			await backend.run((ctx) =>
				ctx.db.delete(
					{
						token: tokenId,
						invite: inviteId,
						campaign: campaignId,
						event: eventId,
						version: versionId,
					}[missing],
				),
			);
			const expected = { status: missing === "event" ? "unavailable" : "invalid" };
			expect(await backend.action(resolveToken, { token })).toEqual(expected);
			expect(await backend.mutation(submitResponse, { token, answers })).toEqual(expected);
		},
	);
	it.each([
		"invite-retained",
		"campaign-retained",
		"identity-removed",
		"version-unassigned",
		"empty-fields",
	] as const)("rejects %s", async (state) => {
		const { backend, inviteId, campaignId, versionId } = await setupTokenFeedback();
		await backend.run(async (ctx) => {
			if (state === "invite-retained") await ctx.db.patch(inviteId, { retainedAt: 0 });
			if (state === "campaign-retained") await ctx.db.patch(campaignId, { retainedAt: 0 });
			if (state === "identity-removed") await ctx.db.patch(inviteId, { userId: undefined });
			if (state === "version-unassigned")
				await ctx.db.patch(campaignId, { formVersionId: undefined });
			if (state === "empty-fields")
				for (const field of await ctx.db
					.query("formFields")
					.withIndex("by_formVersionId_and_order", (index) => index.eq("formVersionId", versionId))
					.collect())
					await ctx.db.delete(field._id);
		});
		expect(await backend.action(resolveToken, { token })).toEqual({ status: "invalid" });
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "invalid",
		});
	});
	it.each<FeedbackAnswers>([
		{ satisfaction: 6 },
		{ toughts: " " },
		{ word_of_mouth: [] },
		{ other: "x".repeat(1001) },
		{ userId: "forged" },
		{ eventId: "forged" },
	])("rejects invalid answers %j and allows a corrected retry", async (invalidAnswers) => {
		const { backend, inviteId } = await setupTokenFeedback();
		const rejected = await backend.mutation(submitResponse, {
			token,
			answers: { ...answers, ...invalidAnswers },
		});
		expect(rejected.status).toBe("validation-error");
		expect(await backend.run((ctx) => ctx.db.get(inviteId))).toMatchObject({ responded: false });
		expect(await backend.run((ctx) => ctx.db.query("formResponses").collect())).toEqual([]);
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "submitted",
		});
	});
	it("rejects an existing response even if the invite flag is stale", async () => {
		const { backend, campaignId, versionId, inviteId } = await setupTokenFeedback();
		await backend.run((ctx) =>
			ctx.db.insert("formResponses", {
				campaignId,
				formVersionId: versionId,
				inviteId,
				data: answers,
				submittedAt: now,
			}),
		);
		expect(await backend.action(resolveToken, { token })).toEqual({ status: "already-submitted" });
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "already-submitted",
		});
		expect(await backend.run((ctx) => ctx.db.query("formResponses").collect())).toHaveLength(1);
	});
	it("blocks a responded invite even if its response has been removed", async () => {
		const { backend, inviteId } = await setupTokenFeedback();
		await backend.run((ctx) => ctx.db.patch(inviteId, { responded: true }));
		expect(await backend.action(resolveToken, { token })).toEqual({ status: "already-submitted" });
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "already-submitted",
		});
	});
	it("accepts exactly one concurrent submission across reminder tokens", async () => {
		const { backend, inviteId, campaignId } = await setupTokenFeedback();
		const reminderToken = "b".repeat(64);
		const reminderHash = await hashLinkToken(reminderToken);
		await backend.run(async (ctx) => {
			const deliveryId = await ctx.db.insert("feedbackDeliveries", {
				campaignId,
				inviteId,
				round: 1,
				emailId: "local:reminder",
				queuedAt: now,
			});
			await ctx.db.insert("feedbackTokens", { inviteId, deliveryId, tokenHash: reminderHash });
		});
		const results = await Promise.all([
			backend.mutation(submitResponse, { token, answers }),
			backend.mutation(submitResponse, { token: reminderToken, answers }),
		]);
		expect(results.map((result) => result.status).sort()).toEqual([
			"already-submitted",
			"submitted",
		]);
		expect(await backend.run((ctx) => ctx.db.query("formResponses").collect())).toHaveLength(1);
		expect(await backend.action(resolveToken, { token: reminderToken })).toEqual({
			status: "already-submitted",
		});
	});
	it("uses the campaign snapshot after later form publications", async () => {
		const { backend, publisherClient, formId, versionId } = await setupTokenFeedback();
		await publisherClient.mutation(formMutations.saveDraft, {
			formId,
			name: "Changed",
			fields: [{ key: "new_question", type: "text", label: "New question", required: true }],
		});
		await publisherClient.mutation(formMutations.publish, { formId });
		const resolved = await backend.action(resolveToken, { token });
		expect(resolved).toMatchObject({
			status: "open",
			form: { name: "Feedback", fields: defaultFeedbackFields },
		});
		expect(await backend.mutation(submitResponse, { token, answers })).toEqual({
			status: "submitted",
		});
		expect(await backend.run((ctx) => ctx.db.query("formResponses").first())).toMatchObject({
			formVersionId: versionId,
		});
	});
});
