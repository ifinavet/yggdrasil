import { HUGIN_URL } from "@workspace/shared/constants";
import { formatNokFromOre } from "@workspace/shared/products";
import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { osloToday } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emailsFrom, sentEmails, tokenFrom } from "../../../test/confirmationEmails";
import {
	activityFor,
	DAY_IN_MS,
	insertSemester,
	refusalMessageFrom,
	setup,
	type TestBackend,
} from "../../../test/fixtures";
import {
	brregUnit,
	type RegistryStubs,
	stubRegistries,
	VALID_ORG_NUMBER,
} from "../../../test/registryFetch";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const submit = api.semesterPlanning.applications.submit.submit;
const resend = api.semesterPlanning.applications.submit.resendConfirmation;
const confirmation = api.semesterPlanning.applications.confirmation;

type Form = Parameters<TestBackend["action"]>[1] extends infer _ ? Record<string, unknown> : never;

function validForm(overrides: Record<string, unknown> = {}) {
	return {
		orgNumber: VALID_ORG_NUMBER,
		contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+47 412 34 567" },
		eventType: "standard_presentation" as const,
		minStudents: 25,
		maxStudents: 40,
		description: "Presentasjon og kodeoppgave i grupper.",
		availableDates: ["2027-02-09", "2027-02-16"],
		datePreferences: "Helst før 15. feb",
		venue: "campus" as const,
		wantsToUseEscape: "unsure" as const,
		foodAndDrinks: true,
		foodPurchasedBy: "company" as const,
		billing: {
			email: "faktura@fjordkode.no",
			details: "Referanse: PO-2027-014",
			ehfInvoice: false,
		},
		targetDegrees: ["Bachelor" as const],
		targetStudyPrograms: [],
		consent: true,
		...overrides,
	};
}

let submissionCounter = 0;
function nextSubmissionId() {
	submissionCounter += 1;
	return `submission-${submissionCounter}-abcdef`;
}

async function withOpenSemester(t: TestBackend): Promise<Id<"semesters">> {
	const semesterId = await insertSemester(t, { status: "open" });
	await t.run(async (ctx) => {
		await ctx.db.insert("semesterDates", {
			semesterId,
			date: "2027-01-19",
			closedLabel: "Kickoff",
		});
		await ctx.db.insert("semesterDates", { semesterId, date: "2027-02-09" });
		await ctx.db.insert("semesterDates", { semesterId, date: "2027-02-16" });
	});
	return semesterId;
}

async function applications(t: TestBackend) {
	return t.run((ctx) => ctx.db.query("companyApplications").collect());
}

/** The semester Hugin would pick: the open one, else whatever semester exists. */
async function chosenSemesterId(t: TestBackend): Promise<Id<"semesters">> {
	const semester = await t.run(
		async (ctx) =>
			(await ctx.db
				.query("semesters")
				.withIndex("by_status", (q) => q.eq("status", "open"))
				.first()) ?? (await ctx.db.query("semesters").first()),
	);
	if (!semester) throw new Error("Expected a semester.");
	return semester._id;
}

/**
 * Sends the form like Hugin, and by default confirms it from the emailed link, so the application
 * is received. With `confirm: false` it stays pending.
 */
async function submitWith(
	t: TestBackend,
	{
		semesterId,
		form = validForm(),
		stubs = {},
		submissionId = nextSubmissionId(),
		website,
		confirm = true,
	}: {
		semesterId?: Id<"semesters">;
		form?: Form;
		stubs?: RegistryStubs;
		submissionId?: string;
		website?: string;
		confirm?: boolean;
	} = {},
) {
	stubRegistries(stubs);
	const spy = sentEmails();
	const result = await t.action(submit, {
		semesterId: semesterId ?? (await chosenSemesterId(t)),
		// biome-ignore lint/suspicious/noExplicitAny: the refusal cases deliberately send invalid forms.
		form: form as any,
		submissionId,
		...(website !== undefined ? { website } : {}),
	});
	const emails = emailsFrom(spy);
	spy.mockRestore();
	const token = emails.length ? tokenFrom(emails[0]?.html) : undefined;
	if (confirm && token) await t.mutation(confirmation.confirm, { token });
	return { result, emails, token, submissionId };
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("submit", () => {
	it("alerts once when the validated company application is received", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		await t.run((ctx) =>
			ctx.db.insert("products", {
				name: "Ordinær bedriftspresentasjon",
				shortDescription: "",
				longDescription: "",
				category: "event",
				eventType: "standard_presentation",
				unitPriceOre: 3_000_000,
				vatRate: 25,
				sortOrder: 0,
				active: true,
			}),
		);
		const submissionId = "bedpres-once-abcdef";
		await submitWith(t, { submissionId });
		await submitWith(t, { submissionId });

		const [application] = await applications(t);
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		const alerts = scheduled.filter(({ name }) => name.includes("notifications:sendMessage"));
		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.args[0]).toMatchObject({
			channel: SYSTEM_ALERTS_CHANNEL,
			text: expect.stringContaining("*Type:* Bedriftspresentasjon"),
		});
		expect(alerts[0]?.args[0].text).toContain("FJORDKODE AS");
		expect(alerts[0]?.args[0].text).toContain("Bedriftspresentasjon med FJORDKODE AS");
		expect(alerts[0]?.args[0].text).toContain("Presentasjon og kodeoppgave i grupper.");
		expect(alerts[0]?.args[0].text).toContain(`${formatNokFromOre(3_000_000)} eks. mva`);
		expect(alerts[0]?.args[0].text).toContain(`/semesterplan/soknad/${application?._id}`);
	});

	it("queues the received application for the Google Sheet copy", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		await submitWith(t);

		const [application] = await applications(t);
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(20));
		const sheetJobs = scheduled.filter(({ name }) => name.includes("sheet:appendApplication"));
		expect(sheetJobs.map(({ args }) => args[0])).toEqual([{ applicationId: application?._id }]);
	});

	it("saves the application with the brreg snapshot, billing and consent version", async () => {
		const { t } = await setup();
		const semesterId = await withOpenSemester(t);

		expect((await submitWith(t)).result).toBeNull();

		const [application] = await applications(t);
		expect(application).toMatchObject({
			semesterId,
			status: "applied",
			orgNumber: VALID_ORG_NUMBER,
			formVersion: 1,
			wantsToUseEscape: "unsure",
			foodPurchasedBy: "company",
			registry: {
				name: "FJORDKODE AS",
				organizationForm: { code: "AS", description: "Aksjeselskap" },
				businessAddress: {
					addressLines: ["Storgata 12"],
					postalCode: "0155",
					city: "OSLO",
					countryCode: "NO",
				},
				industry: { code: "62.100", description: "Programmeringstjenester" },
				website: "www.fjordkode.no",
				employeeCount: 48,
			},
			billing: {
				email: "faktura@fjordkode.no",
				details: "Referanse: PO-2027-014",
				ehfInvoice: false,
			},
			consent: { version: "2026-10" },
		});
		expect(application?.assignedDate).toBeUndefined();
	});

	it("records «received» in the history, from the company", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		await submitWith(t);

		const [application] = await applications(t);
		const history = await activityFor(t, application?._id as Id<"companyApplications">);
		expect(history.map((row) => [row.type, row.actor])).toEqual([["submitted", "company"]]);
	});

	it("refuses an application after a hard deadline, and accepts one after a soft deadline", async () => {
		const { t } = await setup();
		const semesterId = await withOpenSemester(t);
		await t.run((ctx) =>
			ctx.db.patch(semesterId, { applicationDeadline: "2020-01-01", hardDeadline: true }),
		);
		expect(await refusalMessageFrom(submitWith(t))).toBe("Søknadsfristen har gått ut.");

		await t.run((ctx) => ctx.db.patch(semesterId, { hardDeadline: false }));
		await submitWith(t);
		expect(await applications(t)).toHaveLength(1);
	});

	it("accepts an application on the day of a hard deadline", async () => {
		const { t } = await setup();
		const semesterId = await withOpenSemester(t);
		await t.run((ctx) =>
			ctx.db.patch(semesterId, {
				applicationDeadline: osloToday(Date.now()),
				hardDeadline: true,
			}),
		);

		await submitWith(t);
		expect(await applications(t)).toHaveLength(1);
	});

	it.each([
		["only an email", { email: "faktura@fjordkode.no", ehfInvoice: false }],
		["only a text and EHF", { details: "EHF til 982463718", ehfInvoice: true }],
	])("accepts billing with %s", async (_case, billing) => {
		const { t } = await setup();
		await withOpenSemester(t);

		await submitWith(t, { form: validForm({ billing }) });

		expect((await applications(t))[0]?.billing).toEqual(billing);
	});

	it("treats billing without an EHF answer as no EHF", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		await submitWith(t, { form: validForm({ billing: { email: "faktura@fjordkode.no" } }) });

		expect((await applications(t))[0]?.billing).toEqual({
			email: "faktura@fjordkode.no",
			ehfInvoice: false,
		});
	});

	it("refuses billing with neither an email nor a text", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		expect(
			await refusalMessageFrom(
				submitWith(t, { form: validForm({ billing: { ehfInvoice: false } }) }),
			),
		).toBe("Skriv en e-post for faktura, eller hvordan dere vil ha fakturaen.");
	});

	it("saves one application when the same submission arrives twice", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		await submitWith(t, { submissionId: "same-submission-1" });
		await submitWith(t, { submissionId: "same-submission-1" });

		expect(await applications(t)).toHaveLength(1);
	});

	it("allows a second application from the same company with a new submission", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		await submitWith(t);
		await submitWith(t, { form: validForm({ eventType: "workshop", maxStudents: 30 }) });

		expect(await applications(t)).toHaveLength(2);
	});

	it("answers a filled-in honeypot like a success, without saving or calling brreg", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		const calls = stubRegistries();

		expect(
			await t.action(submit, {
				semesterId: await chosenSemesterId(t),
				form: validForm(),
				submissionId: nextSubmissionId(),
				website: "http://spam",
			}),
		).toBeNull();

		expect(await applications(t)).toHaveLength(0);
		expect(calls).toEqual([]);
	});

	it.each([
		[
			"an invalid organization number",
			{ form: validForm({ orgNumber: "982463719" }) },
			"Organisasjonsnummeret er ugyldig.",
		],
		[
			"an unknown company",
			{ stubs: { unitStatus: 404, unit: {} } },
			"Fant ikke bedriften i Enhetsregisteret.",
		],
		[
			"a deleted company",
			{ stubs: { unitStatus: 410, unit: { slettedato: "2024-01-01" } } },
			"Bedriften er slettet fra Enhetsregisteret og kan ikke søke.",
		],
		[
			"a bankrupt company",
			{ stubs: { unit: brregUnit({ konkurs: true }) } },
			"Bedriften er konkurs og kan ikke søke.",
		],
		[
			"a company in liquidation",
			{ stubs: { unit: brregUnit({ underTvangsavviklingEllerTvangsopplosning: true }) } },
			"Bedriften er under avvikling og kan ikke søke.",
		],
		[
			"brreg being down",
			{ stubs: { brregDown: true } },
			"Vi får ikke kontakt med Brønnøysundregistrene akkurat nå. Prøv igjen om litt.",
		],
		[
			"missing consent",
			{ form: validForm({ consent: false }) },
			"Kryss av her, så vi kan ta vare på søknaden deres.",
		],
		[
			"too many students for the type",
			{ form: validForm({ maxStudents: 60 }) },
			"Ordinær bedriftspresentasjon har plass til 40. Velg «Stor bedriftspresentasjon» for flere.",
		],
		[
			"min above max",
			{ form: validForm({ minStudents: 45, maxStudents: 40 }) },
			"Minste antall kan ikke være større enn høyeste antall.",
		],
		["no dates", { form: validForm({ availableDates: [] }) }, "Velg minst én dato."],
		[
			"a closed date",
			{ form: validForm({ availableDates: ["2027-01-19"] }) },
			"Én eller flere av datoene er ikke åpne lenger. Last inn siden på nytt.",
		],
		[
			"a date outside the semester",
			{ form: validForm({ availableDates: ["2027-08-17"] }) },
			"Én eller flere av datoene er ikke åpne lenger. Last inn siden på nytt.",
		],
		[
			"an invalid email",
			{ form: validForm({ contact: { name: "Ingrid", email: "ingrid", phone: "+4741234567" } }) },
			"Skriv en gyldig e-postadresse til kontaktpersonen.",
		],
		[
			"a bad submission id",
			{ submissionId: "x" },
			"Skjemaet har blitt oppdatert siden dere åpnet det. Last inn siden på nytt, så er dere i gang igjen. Svarene deres er lagret.",
		],
	] as const)("refuses %s", async (_case, options, expected) => {
		const { t } = await setup();
		await withOpenSemester(t);

		const message = await refusalMessageFrom(
			submitWith(t, options as Parameters<typeof submitWith>[1]),
		);

		expect(message).toBe(expected);
		expect(await applications(t)).toHaveLength(0);
	});

	it("refuses a semester that is not open", async () => {
		const { t } = await setup();
		const draft = await insertSemester(t, { status: "draft" });
		expect(await refusalMessageFrom(submitWith(t, { semesterId: draft }))).toBe(
			"Søknadene er stengt.",
		);

		await t.run((ctx) => ctx.db.patch(draft, { status: "closed" }));
		expect(await refusalMessageFrom(submitWith(t, { semesterId: draft }))).toBe(
			"Søknadene er stengt.",
		);
	});

	it("saves into the chosen semester when two are open", async () => {
		const { t } = await setup();
		const spring = await withOpenSemester(t);
		const autumn = await insertSemester(t, {
			year: 2026,
			term: "autumn",
			firstDate: "2026-08-18",
			lastDate: "2026-11-26",
			applicationDeadline: "2026-06-01",
			status: "open",
		});
		await t.run((ctx) =>
			ctx.db.insert("semesterDates", { semesterId: autumn, date: "2026-09-29" }),
		);

		await submitWith(t, {
			semesterId: autumn,
			form: validForm({ availableDates: ["2026-09-29"] }),
		});
		await submitWith(t, { semesterId: spring });

		expect((await applications(t)).map((application) => application.semesterId).sort()).toEqual(
			[autumn, spring].sort(),
		);
	});

	it("refuses dates that belong to another open semester", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		const autumn = await insertSemester(t, {
			year: 2026,
			term: "autumn",
			applicationDeadline: "2026-06-01",
			status: "open",
		});
		await t.run((ctx) =>
			ctx.db.insert("semesterDates", { semesterId: autumn, date: "2026-09-29" }),
		);

		// Spring dates sent with the autumn semester.
		expect(await refusalMessageFrom(submitWith(t, { semesterId: autumn }))).toBe(
			"Én eller flere av datoene er ikke åpne lenger. Last inn siden på nytt.",
		);
		expect(await applications(t)).toHaveLength(0);
	});

	it("rate limits one company after five applications in an hour", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		for (let i = 0; i < 5; i += 1) await submitWith(t);
		const message = await refusalMessageFrom(submitWith(t));

		expect(message).toBe(
			"Det har kommet mange søknader på kort tid. Vent litt, og prøv igjen om en stund.",
		);
		expect(await applications(t)).toHaveLength(5);
	});
});

describe("confirmation by email", () => {
	async function pending(t: TestBackend) {
		return t.run((ctx) => ctx.db.query("pendingCompanyApplications").collect());
	}

	it("emails the contact person a link, and Navet sees nothing before it is confirmed", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		const { emails, token } = await submitWith(t, { confirm: false });

		expect(emails).toHaveLength(1);
		expect(emails[0]).toMatchObject({
			to: "ingrid@fjordkode.no",
			subject: "Bekreft søknaden deres om bedriftsarrangement",
		});
		expect(emails[0]?.html).toContain(`${HUGIN_URL}/bestill-bedpres/bekreft#token=`);
		expect(emails[0]?.html).toContain("FJORDKODE AS");
		expect(await applications(t)).toHaveLength(0);
		expect(await pending(t)).toHaveLength(1);
		const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
		expect(scheduled.some(({ name }) => name.includes("notifications:sendMessage"))).toBe(false);
		expect(await t.query(confirmation.link, { token: token ?? "" })).toEqual({ state: "pending" });
	});

	it("receives the application once and shows the same receipt when the link is opened again", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		const { token = "" } = await submitWith(t, { confirm: false });

		const first = await t.mutation(confirmation.confirm, { token });
		const again = await t.mutation(confirmation.confirm, { token });

		expect(first).toEqual({
			state: "confirmed",
			receipt: {
				company: { name: "FJORDKODE AS", orgNumber: VALID_ORG_NUMBER },
				eventType: "standard_presentation",
				minStudents: 25,
				maxStudents: 40,
				availableDates: ["2027-02-09", "2027-02-16"],
				venue: "campus",
				wantsToUseEscape: "unsure",
				billing: { email: "faktura@fjordkode.no", details: "Referanse: PO-2027-014" },
				applicationDeadline: "2026-12-04",
				late: false,
			},
		});
		expect(again).toEqual(first);
		expect(await t.query(confirmation.link, { token })).toEqual(first);
		expect(await applications(t)).toHaveLength(1);
	});

	it("sends a new link on request, and none once the application is received", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		const { token: firstToken = "", submissionId } = await submitWith(t, { confirm: false });

		const spy = sentEmails();
		await t.action(resend, { submissionId });
		const [email] = emailsFrom(spy);
		const secondToken = tokenFrom(email?.html);
		expect(secondToken).not.toBe(firstToken);

		await t.mutation(confirmation.confirm, { token: secondToken });
		expect(await t.query(confirmation.link, { token: firstToken })).toMatchObject({
			state: "confirmed",
		});

		spy.mockClear();
		await t.action(resend, { submissionId });
		expect(emailsFrom(spy)).toHaveLength(0);
		spy.mockRestore();
		const { emails: resubmitted } = await submitWith(t, { submissionId });
		expect(resubmitted).toHaveLength(0);
		expect(await applications(t)).toHaveLength(1);
	});

	it("sends a retry with a corrected email to the new address, and drops the old link", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		const submissionId = "corrected-email-abcdef";
		const typo = { name: "Ingrid Solberg", email: "ingird@fjordkode.no", phone: "+47 412 34 567" };
		const { token: oldToken = "" } = await submitWith(t, {
			submissionId,
			form: validForm({ contact: typo }),
			confirm: false,
		});

		const { emails, token: newToken = "" } = await submitWith(t, { submissionId, confirm: false });

		expect(emails.map((email) => email.to)).toEqual(["ingrid@fjordkode.no"]);
		expect(await t.query(confirmation.link, { token: oldToken })).toEqual({ state: "invalid" });
		await t.mutation(confirmation.confirm, { token: newToken });
		expect((await applications(t)).map((application) => application.contact.email)).toEqual([
			"ingrid@fjordkode.no",
		]);
	});

	it("answers expired after a day and deletes the unconfirmed application", async () => {
		vi.useFakeTimers();
		const { t } = await setup();
		await withOpenSemester(t);
		const { token = "" } = await submitWith(t, { confirm: false });

		vi.advanceTimersByTime(DAY_IN_MS + 1);
		expect(await t.mutation(confirmation.confirm, { token })).toEqual({ state: "expired" });

		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(await pending(t)).toHaveLength(0);
		expect(await t.run((ctx) => ctx.db.query("companyApplicationConfirmations").collect())).toEqual(
			[],
		);
		expect(await applications(t)).toHaveLength(0);
	});

	it("keeps a received application when its links expire", async () => {
		vi.useFakeTimers();
		const { t } = await setup();
		await withOpenSemester(t);
		await submitWith(t);

		vi.advanceTimersByTime(DAY_IN_MS + 1);
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(await pending(t)).toHaveLength(0);
		expect(await applications(t)).toHaveLength(1);
	});

	it("counts the day it was sent against a hard deadline", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.parse("2026-12-04T20:00:00Z"));
		const { t } = await setup();
		const semesterId = await withOpenSemester(t);
		await t.run((ctx) => ctx.db.patch(semesterId, { hardDeadline: true }));
		const { token = "" } = await submitWith(t, { confirm: false });

		vi.setSystemTime(Date.parse("2026-12-05T08:00:00Z"));
		expect(await t.mutation(confirmation.confirm, { token })).toMatchObject({
			state: "confirmed",
		});
		expect(await applications(t)).toHaveLength(1);
	});

	it("refuses to confirm once the semester is closed or a date is no longer open", async () => {
		const { t } = await setup();
		const semesterId = await withOpenSemester(t);
		const { token: closedToken = "" } = await submitWith(t, { confirm: false });
		const { token: dateToken = "" } = await submitWith(t, { confirm: false });

		await t.run(async (ctx) => {
			const date = await ctx.db
				.query("semesterDates")
				.withIndex("by_semesterId_and_date", (q) =>
					q.eq("semesterId", semesterId).eq("date", "2027-02-16"),
				)
				.unique();
			if (date) await ctx.db.patch(date._id, { closedLabel: "Eksamen" });
		});
		expect(await t.mutation(confirmation.confirm, { token: dateToken })).toEqual({
			state: "refused",
			message: "Én eller flere av datoene er ikke åpne lenger. Last inn siden på nytt.",
		});

		await t.run((ctx) => ctx.db.patch(semesterId, { status: "closed" }));
		expect(await t.mutation(confirmation.confirm, { token: closedToken })).toEqual({
			state: "refused",
			message: "Søknadene er stengt.",
		});
		expect(await applications(t)).toHaveLength(0);
	});

	it.each([
		["a malformed token", "not-a-token"],
		["an unknown token", "a".repeat(43)],
	])("answers invalid to %s", async (_case, token) => {
		const { t } = await setup();
		expect(await t.query(confirmation.link, { token })).toEqual({ state: "invalid" });
		expect(await t.mutation(confirmation.confirm, { token })).toEqual({ state: "invalid" });
	});
});
