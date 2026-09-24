import type { SendEmailOptions } from "@convex-dev/resend";
import { HUGIN_URL } from "@workspace/shared/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertRegistration,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../../test/fixtures";
import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { defaultFeedbackFields } from "../defaultFields";
import { feedbackResend } from "../delivery/messages";

const sendForm = api.feedback.manualSend.send.send;
const listRegistrants = api.feedback.manualSend.eligibility.listRegistrants;
const resolveToken = api.feedback.responses.actions.resolveFeedbackToken;
const submitResponse = api.feedback.responses.mutations.submitFeedbackResponse;
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

async function fixture() {
	const { t, companyId } = await setup();
	const admin = await insertUser(t, "super@ifinavet.no");
	await grantRole(t, admin._id, "super-admin");
	const adminClient = asUser(t, admin);
	const formId = await adminClient.mutation(api.feedback.forms.mutations.saveDraft, {
		name: "Feedback",
		fields: defaultFeedbackFields,
	});
	const formVersionId = await adminClient.mutation(api.feedback.forms.mutations.publish, {
		formId,
	});
	await adminClient.mutation(api.feedback.forms.mutations.setDefault, { formId });
	const eventId = await insertEvent(t, companyId, { title: "Bedpres med Testbedrift" });
	await adminClient.mutation(api.feedback.events.updateEventFeedbackSettings, {
		eventId,
		enabled: true,
	});
	const sender = await insertUser(t, "styret@example.test");
	await grantRole(t, sender._id, "internal");
	const participant = await insertUser(t, "student@example.test", {
		firstName: "Kari",
		lastName: "Nordmann",
	});
	const registrationId = await insertRegistration(t, eventId, participant._id, "registered");
	const campaign = await t.run((ctx) => ctx.db.query("feedbackCampaigns").first());
	if (!campaign) throw new Error("Enabling feedback should schedule a campaign");
	return {
		t,
		eventId,
		formId,
		formVersionId,
		campaign,
		registrationId,
		participant,
		client: asUser(t, sender),
		args: { eventId, userId: participant._id },
	};
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

function spySentEmails() {
	const sendEmail = vi.spyOn(feedbackResend, "sendEmail");
	return () =>
		sendEmail.mock.calls.map((call) => (call as unknown as [unknown, SendEmailOptions])[1]);
}

function feedbackTokenFrom(html: string | undefined) {
	const token = html?.match(/\/feedback#token=([\w-]+)/)?.[1];
	if (!token) throw new Error("No feedback link in the email");
	return token;
}

async function sendAndReadToken(f: Fixture) {
	const sentEmails = spySentEmails();
	await f.client.action(sendForm, f.args);
	return feedbackTokenFrom(sentEmails()[0]?.html);
}

async function invitesOf(f: Fixture) {
	return f.t.run((ctx) =>
		ctx.db
			.query("feedbackInvites")
			.withIndex("by_campaignId", (index) => index.eq("campaignId", f.campaign._id))
			.collect(),
	);
}

describe("manual feedback form send", () => {
	beforeEach(() => {
		vi.stubEnv("APP_ENV", "test");
		feedbackResend.config.apiKey = "re_test";
	});
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("emails the registrant a real form link before the automatic round opens", async () => {
		const f = await fixture();
		const sentEmails = spySentEmails();

		expect(await f.client.action(sendForm, f.args)).toBe("Kari Nordmann");

		const [email] = sentEmails();
		expect(sentEmails()).toHaveLength(1);
		expect(email).toMatchObject({
			to: "student@example.test",
			subject: "Tilbakemelding: Bedpres med Testbedrift",
			from: "Navet <info@ifinavet.no>",
			replyTo: ["arrangement@ifinavet.no"],
		});
		expect(email?.html).toContain(`${HUGIN_URL}/feedback#token=`);
		expect(f.campaign.status).toBe("scheduled");
		expect(await f.t.action(resolveToken, { token: feedbackTokenFrom(email?.html) })).toMatchObject(
			{
				status: "open",
				event: { title: "Bedpres med Testbedrift" },
				form: { name: "Feedback" },
				closesAt: f.campaign.closesAt,
			},
		);
	});

	it("stores the answers on the event's campaign so they reach its report", async () => {
		const f = await fixture();
		const token = await sendAndReadToken(f);

		expect(await f.t.mutation(submitResponse, { token, answers })).toEqual({
			status: "submitted",
		});
		expect(await f.t.mutation(submitResponse, { token, answers })).toEqual({
			status: "already-submitted",
		});
		const responses = await f.t.run((ctx) => ctx.db.query("formResponses").collect());
		expect(responses).toMatchObject([
			{ campaignId: f.campaign._id, formVersionId: f.formVersionId, data: answers },
		]);
		expect(await invitesOf(f)).toMatchObject([{ responded: true }]);
	});

	it("records who sent the invite and keeps the automatic invitation from inviting twice", async () => {
		const f = await fixture();
		await f.client.action(sendForm, f.args);
		const checkedIn = await insertUser(f.t, "checked-in@example.test");
		await f.t.run(async (ctx) => {
			await ctx.db.patch(f.registrationId, { attendanceStatus: "confirmed" });
			await ctx.db.insert("registrations", {
				eventId: f.eventId,
				userId: checkedIn._id,
				status: "registered",
				registrationTime: Date.now(),
				attendanceStatus: "confirmed",
			});
			await ctx.db.patch(f.campaign._id, {
				status: "open",
				opensAt: Date.now() - 1,
				formVersionId: f.formVersionId,
			});
		});

		await f.t.mutation(internal.feedback.delivery.campaigns.inviteParticipants, {
			campaignId: f.campaign._id,
			generation: f.campaign.generation,
			cursor: null,
		});

		const invites = await invitesOf(f);
		expect(invites).toHaveLength(2);
		expect(invites.find(({ userId }) => userId === f.participant._id)).toMatchObject({
			sentBy: expect.any(String),
			formVersionId: f.formVersionId,
		});
		expect(invites.find(({ userId }) => userId === checkedIn._id)).toMatchObject({
			workflowId: expect.any(String),
		});
		expect(invites.find(({ userId }) => userId === checkedIn._id)).not.toHaveProperty("sentBy");
	});

	it("stops the manually sent form when feedback is turned off for the event", async () => {
		const f = await fixture();
		const token = await sendAndReadToken(f);
		await f.client.mutation(api.feedback.events.updateEventFeedbackSettings, {
			eventId: f.eventId,
			enabled: false,
		});

		expect(await f.t.action(resolveToken, { token })).toEqual({ status: "unavailable" });
	});

	it("captures the email locally instead of sending it in local development", async () => {
		const f = await fixture();
		vi.stubEnv("APP_ENV", "local");
		vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
		const sentEmails = spySentEmails();

		await f.client.action(sendForm, f.args);

		expect(sentEmails()).toEqual([]);
		const captured = await f.t.run((ctx) => ctx.db.query("feedbackLocalEmails").collect());
		expect(captured).toMatchObject([
			{ to: "student@example.test", subject: "Tilbakemelding: Bedpres med Testbedrift" },
		]);
		expect(
			await f.t.action(resolveToken, { token: feedbackTokenFrom(captured[0]?.url) }),
		).toMatchObject({ status: "open" });
	});

	it("lists the event's registered participants for internal members", async () => {
		const f = await fixture();
		const waiting = await insertUser(f.t, "waiting@example.test");
		await insertRegistration(f.t, f.eventId, waiting._id, "waitlist");
		const deleted = await insertUser(f.t, "deleted@example.test");
		await insertRegistration(f.t, f.eventId, deleted._id, "registered");
		await f.t.run((ctx) => ctx.db.delete(deleted._id));

		expect(await f.client.query(listRegistrants, { eventId: f.eventId })).toEqual([
			{ userId: f.participant._id, name: "Kari Nordmann", email: "student@example.test" },
		]);
		expect(
			await refusalMessageFrom(
				asUser(f.t, f.participant).query(listRegistrants, { eventId: f.eventId }),
			),
		).toContain("Unauthorized");
	});

	describe("refuses and sends nothing", () => {
		const refusals: Array<[string, (f: Fixture) => Promise<unknown>, string]> = [
			["for callers without an internal role", async () => {}, "Unauthorized"],
			[
				"for an event that does not exist",
				(f) => f.t.run((ctx) => ctx.db.delete(f.eventId)),
				"Fant ikke arrangementet.",
			],
			[
				"when feedback is off for the event",
				(f) =>
					f.client.mutation(api.feedback.events.updateEventFeedbackSettings, {
						eventId: f.eventId,
						enabled: false,
					}),
				"Arrangementet har ingen aktiv innsamling av tilbakemeldinger.",
			],
			[
				"when the event has no campaign",
				(f) => f.t.run((ctx) => ctx.db.delete(f.campaign._id)),
				"Arrangementet har ingen aktiv innsamling av tilbakemeldinger.",
			],
			[
				"after the campaign has closed",
				(f) => f.t.run((ctx) => ctx.db.patch(f.campaign._id, { status: "closed" })),
				"Arrangementet har ingen aktiv innsamling av tilbakemeldinger.",
			],
			[
				"for a participant on the waitlist",
				(f) => f.t.run((ctx) => ctx.db.patch(f.registrationId, { status: "waitlist" })),
				"Deltakeren er ikke påmeldt arrangementet.",
			],
			[
				"for a participant who already has the form",
				(f) => f.client.action(sendForm, f.args),
				"Deltakeren har allerede fått skjemaet.",
			],
			[
				"when no form is published",
				(f) => f.t.run((ctx) => ctx.db.patch(f.formId, { isDefault: false })),
				"Velg et publisert skjema.",
			],
			[
				"when the company does not exist",
				async (f) => {
					const event = await f.t.run((ctx) => ctx.db.get(f.eventId));
					await f.t.run((ctx) => ctx.db.delete(event?.hostingCompany as Id<"companies">));
				},
				"Fant ikke bedriften.",
			],
		];

		it.each(refusals)("%s", async (name, arrange, message) => {
			const f = await fixture();
			await arrange(f);
			const client = name.startsWith("for callers") ? asUser(f.t, f.participant) : f.client;
			const sentEmails = spySentEmails();

			expect(await refusalMessageFrom(client.action(sendForm, f.args))).toContain(message);
			expect(sentEmails()).toEqual([]);
		});
	});
});
