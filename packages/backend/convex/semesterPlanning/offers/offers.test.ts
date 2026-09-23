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
	scheduledCallsOf,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const offers = api.semesterPlanning.offers;

type OfferEmail = { to: string; url: string; dateLabel: string; respondByLabel?: string };

async function offerSetup() {
	const { t } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	const semesterId = await insertSemester(t, {
		status: "open",
		termsUrl: "https://ifinavet.no/vilkar-v27",
		offerResponseDays: 14,
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
	const applicationId = await insertApplication(t, semesterId, {
		assignedDate: "2027-02-09",
		filledInByEmail: "assistent@fjordkode.no",
	});
	return { t, semesterId, applicationId, editorUser, editor: asUser(t, editorUser) };
}

async function sendAndGetToken(
	t: TestBackend,
	editor: ReturnType<typeof asUser>,
	applicationId: Id<"companyApplications">,
): Promise<string> {
	await editor.mutation(offers.mutations.send, { applicationId });
	const emails = (await scheduledCallsOf(t, "sendOfferEmail")) as OfferEmail[];
	const url = emails.at(-1)?.url ?? "";
	return url.slice(url.lastIndexOf("/") + 1);
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
	it("stores only the token hash and emails the link to the contact person", async () => {
		const { t, applicationId, editor, editorUser } = await offerSetup();

		const token = await sendAndGetToken(t, editor, applicationId);

		const [offer] = await offersOf(t, applicationId);
		expect(offer).toMatchObject({
			date: "2027-02-09",
			eventType: "standard_presentation",
			maxStudents: 40,
			status: "pending",
			sentBy: editorUser._id,
		});
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(JSON.stringify(offer)).not.toContain(token);
		expect(offer?.respondBy).toBeGreaterThan(Date.now());

		const [email] = (await scheduledCallsOf(t, "sendOfferEmail")) as OfferEmail[];
		expect(email).toMatchObject({
			to: "ingrid@fjordkode.no",
			url: `https://hugin.ifinavet.no/bestill-bedpres/tilbud/${token}`,
			dateLabel: "tirsdag 9. februar 2027",
		});
		expect(email?.respondByLabel).toBeDefined();
		expect((await applicationById(t, applicationId)).status).toBe("offer_sent");
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			type: "status_changed",
			toStatus: "offer_sent",
			offerId: offer?._id,
		});
	});

	it("sending again makes a new link and switches the old one off", async () => {
		const { t, applicationId, editor } = await offerSetup();

		const oldToken = await sendAndGetToken(t, editor, applicationId);
		const newToken = await sendAndGetToken(t, editor, applicationId);

		expect(newToken).not.toBe(oldToken);
		expect((await offersOf(t, applicationId)).map((offer) => offer.status)).toEqual([
			"superseded",
			"pending",
		]);
		expect(await t.query(offers.queries.getByToken, { token: oldToken })).toMatchObject({
			state: "superseded",
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
			await refusalMessageFrom(editor.mutation(offers.mutations.send, { applicationId })),
		).toBe(expected);
		expect(await offersOf(t, applicationId)).toHaveLength(0);
	});

	it("is editor-only", async () => {
		const { t, applicationId } = await offerSetup();
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");

		expect(
			await refusalMessageFrom(
				asUser(t, member).mutation(offers.mutations.send, { applicationId }),
			),
		).toContain("Unauthorized");
	});
});

describe("getByToken", () => {
	it("shows an open offer with the other open dates, and nothing private", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);

		const offer = await t.query(offers.queries.getByToken, { token });

		expect(offer).toMatchObject({
			state: "pending",
			companyName: "FJORDKODE AS",
			date: "2027-02-09",
			maxStudents: 40,
			venue: "campus",
			termsUrl: "https://ifinavet.no/vilkar-v27",
			openDates: ["2027-02-11", "2027-02-16"],
		});
		expect(JSON.stringify(offer)).not.toMatch(/ingrid|faktura|\+47/);
	});

	it("answers «unknown» for a made-up token", async () => {
		const { t } = await offerSetup();
		expect(await t.query(offers.queries.getByToken, { token: "x".repeat(43) })).toEqual({
			state: "unknown",
		});
	});

	it("shows a withdrawn application's offer as inactive", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);
		await t.run((ctx) => ctx.db.patch(applicationId, { status: "withdrawn" }));

		expect(await t.query(offers.queries.getByToken, { token })).toMatchObject({
			state: "inactive",
		});
	});
});

describe("accept", () => {
	it("confirms the application, snapshots the terms and emails the company and Navet", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);

		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });

		expect((await applicationById(t, applicationId)).status).toBe("confirmed");
		expect((await offersOf(t, applicationId))[0]).toMatchObject({
			status: "accepted",
			acceptedTermsUrl: "https://ifinavet.no/vilkar-v27",
		});
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			type: "status_changed",
			actor: "company",
			toStatus: "confirmed",
		});
		expect(await scheduledCallsOf(t, "sendOfferConfirmedEmail")).toEqual([
			{
				to: ["ingrid@fjordkode.no", "assistent@fjordkode.no"],
				companyName: "FJORDKODE AS",
				dateLabel: "tirsdag 9. februar 2027",
			},
		]);
		expect(await scheduledCallsOf(t, "sendOfferResponseNotice")).toMatchObject([
			{ to: "bedrift@ifinavet.no", answer: "accepted" },
		]);
	});

	it("accepting twice changes nothing the second time", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);

		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });
		const historyAfterFirst = (await activityFor(t, applicationId)).length;
		await t.mutation(offers.mutations.accept, { token, acceptTerms: true });

		expect(await activityFor(t, applicationId)).toHaveLength(historyAfterFirst);
		expect(await scheduledCallsOf(t, "sendOfferConfirmedEmail")).toHaveLength(1);
	});

	it("requires the terms to be accepted", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);

		expect(
			await refusalMessageFrom(t.mutation(offers.mutations.accept, { token, acceptTerms: false })),
		).toBe("Du må godta standardvilkårene for å godta datoen.");
	});

	it("refuses unknown and replaced links, and withdrawn applications", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const oldToken = await sendAndGetToken(t, editor, applicationId);
		const newToken = await sendAndGetToken(t, editor, applicationId);

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
	it("records the wish, keeps the date held and tells Navet", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);

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
			responseComment: "Maks 30 går også fint.",
		});
		expect(await scheduledCallsOf(t, "sendOfferResponseNotice")).toMatchObject([
			{ answer: "new_date_requested" },
		]);
	});

	it.each([
		["no dates", [], "Velg mellom én og ti datoer."],
		["a closed date", ["2027-01-19"], "Velg blant datoene i semesteret."],
		["a date outside the semester", ["2027-08-17"], "Velg blant datoene i semesteret."],
	])("refuses %s", async (_case, dates, expected) => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);

		expect(
			await refusalMessageFrom(t.mutation(offers.mutations.requestNewDate, { token, dates })),
		).toBe(expected);
	});

	it("refuses a second answer on the same link", async () => {
		const { t, applicationId, editor } = await offerSetup();
		const token = await sendAndGetToken(t, editor, applicationId);
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
		await sendAndGetToken(t, editor, applicationId);

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
