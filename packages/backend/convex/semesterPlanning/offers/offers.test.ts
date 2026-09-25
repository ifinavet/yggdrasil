import { MIDGARD_URL } from "@workspace/shared/constants";
import { describe, expect, it } from "vitest";
import {
	activityFor,
	applicationById,
	asUser,
	grantRole,
	insertApplication,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const offers = api.semesterPlanning.offers;

async function offerSetup() {
	const { t } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	const semesterId = await insertSemester(t, {
		status: "open",
		termsUrl: `${MIDGARD_URL}/vilkar-v27`,
	});
	await t.run(async (ctx) => {
		await ctx.db.insert("semesterDates", {
			semesterId,
			date: "2027-01-19",
			closedLabel: "Kickoff",
		});
		for (const date of ["2027-02-09", "2027-02-11", "2027-02-16"]) {
			await ctx.db.insert("semesterDates", { semesterId, date });
		}
	});
	const applicationId = await insertApplication(t, semesterId, { assignedDate: "2027-02-09" });
	return { t, semesterId, applicationId, editorUser, editor: asUser(t, editorUser) };
}

async function sendAndGetToken(
	editor: ReturnType<typeof asUser>,
	applicationId: Id<"companyApplications">,
): Promise<string> {
	const { linkToken } = await editor.mutation(offers.mutations.sendOffer, { applicationId });
	return linkToken;
}

async function offersOf(t: TestBackend, applicationId: Id<"companyApplications">) {
	return t.run((ctx) =>
		ctx.db
			.query("companyApplicationOffers")
			.withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
			.collect(),
	);
}

describe("send", () => {
	it("makes a link for Navet to send by hand", async () => {
		const { t, applicationId, editor, editorUser } = await offerSetup();

		const token = await sendAndGetToken(editor, applicationId);

		const [offer] = await offersOf(t, applicationId);
		expect(offer).toMatchObject({
			date: "2027-02-09",
			eventType: "standard_presentation",
			maxStudents: 40,
			status: "pending",
			sentBy: editorUser._id,
		});
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		// The link can be copied again from Bifrost, which builds it from the token.
		expect(offer?.linkToken).toBe(token);
		expect((await applicationById(t, applicationId)).status).toBe("offer_sent");
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			type: "status_changed",
			toStatus: "offer_sent",
			offerId: offer?._id,
		});
	});

	it("gives the same link again while the offer waits for an answer", async () => {
		const { t, applicationId, editor } = await offerSetup();

		const first = await editor.mutation(offers.mutations.sendOffer, { applicationId });
		const historyAfterFirst = (await activityFor(t, applicationId)).length;
		const second = await editor.mutation(offers.mutations.sendOffer, { applicationId });

		expect(second).toEqual(first);
		expect(await offersOf(t, applicationId)).toHaveLength(1);
		expect(await activityFor(t, applicationId)).toHaveLength(historyAfterFirst);
		expect(await t.query(offers.queries.getByToken, { token: first.linkToken })).toMatchObject({
			state: "pending",
		});
	});

	it.each([
		["no date", { assignedDate: undefined }, "Gi søknaden en dato før du sender tilbud."],
		[
			"a confirmed application",
			{ status: "confirmed" as const },
			"Kan ikke gå fra «Bekreftet» til «Tilbud sendt».",
		],
		[
			"a withdrawn application",
			{ status: "withdrawn" as const },
			"Kan ikke gå fra «Trukket» til «Tilbud sendt».",
		],
	])("refuses %s", async (_case, overrides, expected) => {
		const { t, semesterId, editor } = await offerSetup();
		const applicationId = await insertApplication(t, semesterId, {
			assignedDate: "2027-02-11",
			...overrides,
		});

		expect(
			await refusalMessageFrom(editor.mutation(offers.mutations.sendOffer, { applicationId })),
		).toBe(expected);
		expect(await offersOf(t, applicationId)).toHaveLength(0);
	});

	it("is editor-only", async () => {
		const { t, applicationId } = await offerSetup();
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");

		expect(
			await refusalMessageFrom(
				asUser(t, member).mutation(offers.mutations.sendOffer, { applicationId }),
			),
		).toContain("Unauthorized");
	});
});

describe("getByToken", () => {
	it("shows an open offer with the other open dates, and nothing private", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		const offer = await t.query(offers.queries.getByToken, { token });

		expect(offer).toMatchObject({
			state: "pending",
			companyName: "FJORDKODE AS",
			date: "2027-02-09",
			maxStudents: 40,
			venue: "campus",
			termsUrl: `${MIDGARD_URL}/vilkar-v27`,
			openDates: ["2027-02-11", "2027-02-16"],
		});
		expect(JSON.stringify(offer)).not.toMatch(/ingrid|faktura|\+47/);
	});

	it("leaves out dates another company has confirmed, but keeps dates only offered", async () => {
		const { t, semesterId, applicationId, editor } = await offerSetup();
		await insertApplication(t, semesterId, { assignedDate: "2027-02-11", status: "confirmed" });
		await insertApplication(t, semesterId, { assignedDate: "2027-02-16", status: "offer_sent" });
		const token = await sendAndGetToken(editor, applicationId);

		expect(await t.query(offers.queries.getByToken, { token })).toMatchObject({
			openDates: ["2027-02-16"],
		});
		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.requestNewDate, { token, dates: ["2027-02-11"] }),
			),
		).toBe("Velg blant datoene i semesteret.");
	});

	it("answers «unknown» for a made-up token", async () => {
		const { t } = await offerSetup();
		expect(await t.query(offers.queries.getByToken, { token: "x".repeat(43) })).toEqual({
			state: "unknown",
		});
	});

	it("shows a withdrawn application's offer as inactive", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);
		await t.run((ctx) => ctx.db.patch(applicationId, { status: "withdrawn" }));

		expect(await t.query(offers.queries.getByToken, { token })).toMatchObject({
			state: "inactive",
		});
	});

	it("shows an accepted offer as inactive once the application is withdrawn and reopened", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);
		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });
		expect(await t.query(offers.queries.getByToken, { token })).toMatchObject({
			state: "accepted",
		});

		const applications = api.semesterPlanning.applications.mutations;
		await editor.mutation(applications.withdraw, { applicationId });
		await editor.mutation(applications.reopen, { applicationId });

		expect(await t.query(offers.queries.getByToken, { token })).toMatchObject({
			state: "inactive",
		});
	});
});

describe("accept", () => {
	it("confirms the application and snapshots the terms", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });

		expect((await applicationById(t, applicationId)).status).toBe("confirmed");
		expect((await offersOf(t, applicationId))[0]).toMatchObject({
			status: "accepted",
			acceptedTermsUrl: `${MIDGARD_URL}/vilkar-v27`,
		});
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			type: "status_changed",
			actor: "company",
			toStatus: "confirmed",
		});
	});

	it("accepting twice changes nothing the second time", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });
		const historyAfterFirst = (await activityFor(t, applicationId)).length;
		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });

		expect(await activityFor(t, applicationId)).toHaveLength(historyAfterFirst);
	});

	it("requires the terms to be accepted", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		expect(
			await refusalMessageFrom(t.mutation(offers.mutations.accept, { token, acceptTerms: false })),
		).toBe("Du må godta standardvilkårene for å godta datoen.");
	});

	it("refuses unknown and replaced links, and withdrawn applications", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const oldToken = await sendAndGetToken(editor, applicationId);
		await editor.mutation(api.semesterPlanning.applications.mutations.assignDate, {
			applicationId,
			date: "2027-02-11",
		});
		const newToken = await sendAndGetToken(editor, applicationId);

		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.accept, { token: "y".repeat(43), acceptTerms: true }),
			),
		).toBe("Fant ikke tilbudet.");
		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.accept, { token: oldToken, acceptTerms: true }),
			),
		).toBe("Tilbudet gjelder ikke lenger.");

		await t.run((ctx) => ctx.db.patch(applicationId, { status: "withdrawn" }));
		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.accept, { token: newToken, acceptTerms: true }),
			),
		).toBe("Tilbudet gjelder ikke lenger.");
	});
});

describe("requestNewDate", () => {
	it("records the wish and its comment, and keeps the date held", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		await t.mutation(offers.mutations.requestNewDate, {
			token,
			dates: ["2027-02-16", "2027-02-11", "2027-02-16"],
			comment: " Maks 30 går også fint. ",
		});

		const application = await applicationById(t, applicationId);
		expect([application.status, application.assignedDate]).toEqual([
			"new_date_requested",
			"2027-02-09",
		]);
		expect((await offersOf(t, applicationId))[0]).toMatchObject({
			status: "new_date_requested",
			requestedDates: ["2027-02-16", "2027-02-11"],
		});
		expect((await activityFor(t, applicationId)).at(-1)?.comment).toBe("Maks 30 går også fint.");
	});

	it.each([
		["no dates", [], "Velg mellom én og ti datoer."],
		["a closed date", ["2027-01-19"], "Velg blant datoene i semesteret."],
		["a date outside the semester", ["2027-08-17"], "Velg blant datoene i semesteret."],
	])("refuses %s", async (_case, dates, expected) => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		expect(
			await refusalMessageFrom(t.mutation(offers.mutations.requestNewDate, { token, dates })),
		).toBe(expected);
	});

	it("refuses a second answer on the same link", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);
		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });

		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.requestNewDate, { token, dates: ["2027-02-16"] }),
			),
		).toBe("Dere har allerede godtatt tilbudet.");
	});
});

describe("confirmManually", () => {
	it("confirms on the company's behalf and closes the offer without a terms snapshot", async () => {
		const { t, applicationId, editor, editorUser } = await offerSetup();
		await sendAndGetToken(editor, applicationId);

		await editor.mutation(offers.mutations.confirmManually, {
			applicationId,
			comment: "Svarte ja på e-post.",
		});

		expect((await applicationById(t, applicationId)).status).toBe("confirmed");
		const [offer] = await offersOf(t, applicationId);
		expect(offer?.status).toBe("accepted");
		expect(offer?.acceptedTermsUrl).toBeUndefined();
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			actor: "internal",
			actorUserId: editorUser._id,
			toStatus: "confirmed",
			comment: "Svarte ja på e-post.",
		});
	});

	it("needs a comment and an open offer", async () => {
		const { applicationId, editor } = await offerSetup();

		expect(
			await refusalMessageFrom(
				editor.mutation(offers.mutations.confirmManually, { applicationId, comment: " " }),
			),
		).toBe("Skriv hvordan bedriften bekreftet.");
		expect(
			await refusalMessageFrom(
				editor.mutation(offers.mutations.confirmManually, { applicationId, comment: "Ja" }),
			),
		).toBe("Kan ikke gå fra «Søkt» til «Bekreftet».");
	});
});

describe("decline", () => {
	it("declines the application for the company and frees the date", async () => {
		const { t, semesterId, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);

		await t.mutation(offers.mutations.decline, { token, comment: " Vi rekker det ikke i år. " });

		expect((await applicationById(t, applicationId)).status).toBe("declined");
		expect((await offersOf(t, applicationId))[0]?.status).toBe("declined");
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			type: "status_changed",
			actor: "company",
			toStatus: "declined",
			comment: "Vi rekker det ikke i år.",
		});
		const other = await insertApplication(t, semesterId);
		await editor.mutation(api.semesterPlanning.applications.mutations.assignDate, {
			applicationId: other,
			date: "2027-02-09",
		});
		expect((await applicationById(t, other)).assignedDate).toBe("2027-02-09");
		expect(await t.query(offers.queries.getByToken, { token })).toMatchObject({
			state: "declined",
		});
	});

	it("is harmless twice, and works after asking for another date", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);
		await t.mutation(offers.mutations.requestNewDate, { token, dates: ["2027-02-16"] });

		await t.mutation(offers.mutations.decline, { token });
		const historyAfterFirst = (await activityFor(t, applicationId)).length;
		await t.mutation(offers.mutations.decline, { token });

		expect((await applicationById(t, applicationId)).status).toBe("declined");
		expect(await activityFor(t, applicationId)).toHaveLength(historyAfterFirst);
	});

	it("refuses an offer that is already accepted", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(editor, applicationId);
		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });

		expect(await refusalMessageFrom(t.mutation(offers.mutations.decline, { token }))).toBe(
			"Dere har allerede godtatt tilbudet. Ta kontakt med bedriftskontakten for å avlyse.",
		);
		expect((await applicationById(t, applicationId)).status).toBe("confirmed");
	});
});

describe("an old link", () => {
	const assignDate = api.semesterPlanning.applications.mutations.assignDate;

	/** The company asks for another date on the first offer, and the editor gives it one. */
	async function afterNewDateRequest() {
		const setup = await offerSetup();
		const { t, applicationId, editor } = setup;
		const oldToken = await sendAndGetToken(editor, applicationId);
		await t.mutation(offers.mutations.requestNewDate, { token: oldToken, dates: ["2027-02-16"] });
		await editor.mutation(assignDate, { applicationId, date: "2027-02-16" });
		return { ...setup, oldToken };
	}

	it("cannot withdraw a confirmed application after a newer offer is accepted", async () => {
		const { t, applicationId, editor, oldToken } = await afterNewDateRequest();
		const newToken = await sendAndGetToken(editor, applicationId);
		await t.mutation(offers.mutations.accept, { token: newToken, acceptTerms: true });

		expect(
			await refusalMessageFrom(t.mutation(offers.mutations.decline, { token: oldToken })),
		).toBe("Tilbudet gjelder ikke lenger.");
		expect((await applicationById(t, applicationId)).status).toBe("confirmed");
	});

	it("cannot decline once the editor has moved the application to another date", async () => {
		const { t, applicationId, oldToken } = await afterNewDateRequest();

		expect(
			await refusalMessageFrom(t.mutation(offers.mutations.decline, { token: oldToken })),
		).toBe("Tilbudet gjelder ikke lenger.");
		expect((await applicationById(t, applicationId)).status).toBe("applied");
	});

	it("cannot accept or ask for dates once a newer offer is sent", async () => {
		const { t, applicationId, editor, oldToken } = await afterNewDateRequest();
		await sendAndGetToken(editor, applicationId);

		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.accept, { token: oldToken, acceptTerms: true }),
			),
		).toBe("Tilbudet gjelder ikke lenger.");
		expect(
			await refusalMessageFrom(
				t.mutation(offers.mutations.requestNewDate, { token: oldToken, dates: ["2027-02-11"] }),
			),
		).toBe("Tilbudet gjelder ikke lenger.");
		expect((await applicationById(t, applicationId)).status).toBe("offer_sent");
	});
});
