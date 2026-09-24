import { afterEach, describe, expect, it, vi } from "vitest";
import {
	activityFor,
	insertSemester,
	refusalMessageFrom,
	scheduledCallsOf,
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

type Form = Parameters<TestBackend["action"]>[1] extends infer _ ? Record<string, unknown> : never;

function validForm(overrides: Record<string, unknown> = {}) {
	return {
		orgNumber: VALID_ORG_NUMBER,
		contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+47 412 34 567" },
		filledInByEmail: "assistent@fjordkode.no",
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
		billing: { email: "faktura@fjordkode.no", details: "Referanse: PO-2027-014" },
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

async function submitWith(
	t: TestBackend,
	{
		form = validForm(),
		stubs = {},
		submissionId = nextSubmissionId(),
		website,
	}: {
		form?: Form;
		stubs?: RegistryStubs;
		submissionId?: string;
		website?: string;
	} = {},
) {
	stubRegistries(stubs);
	return t.action(submit, {
		// biome-ignore lint/suspicious/noExplicitAny: the refusal cases deliberately send invalid forms.
		form: form as any,
		submissionId,
		...(website !== undefined ? { website } : {}),
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("submit", () => {
	it("saves the application with the brreg snapshot, billing and consent version", async () => {
		const { t } = await setup();
		const semesterId = await withOpenSemester(t);

		expect(await submitWith(t)).toBeNull();

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
			billing: { email: "faktura@fjordkode.no", details: "Referanse: PO-2027-014" },
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

	it("emails nothing: the receipt is shown on Hugin", async () => {
		const { t } = await setup();
		await withOpenSemester(t);
		await submitWith(t);

		expect(await scheduledCallsOf(t, "sendApplicationReceiptEmail")).toEqual([]);
	});

	it.each([
		["only an email", { email: "faktura@fjordkode.no" }],
		["only a text", { details: "EHF til 982463718" }],
	])("accepts billing with %s", async (_case, billing) => {
		const { t } = await setup();
		await withOpenSemester(t);

		await submitWith(t, { form: validForm({ billing }) });

		expect((await applications(t))[0]?.billing).toEqual(billing);
	});

	it("refuses billing with neither an email nor a text", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		expect(await refusalMessageFrom(submitWith(t, { form: validForm({ billing: {} }) }))).toBe(
			"Skriv en e-post for faktura, eller hvordan dere vil ha fakturaen.",
		);
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
			"Du må godta lagring for å sende søknaden.",
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
		["a bad submission id", { submissionId: "x" }, "Skjemaet er utdatert. Last inn siden på nytt."],
	] as const)("refuses %s", async (_case, options, expected) => {
		const { t } = await setup();
		await withOpenSemester(t);

		const message = await refusalMessageFrom(
			submitWith(t, options as Parameters<typeof submitWith>[1]),
		);

		expect(message).toBe(expected);
		expect(await applications(t)).toHaveLength(0);
	});

	it("refuses when no semester is open", async () => {
		const { t } = await setup();
		await insertSemester(t, { status: "draft" });

		expect(await refusalMessageFrom(submitWith(t))).toBe("Søknadene er stengt.");
	});

	it("rate limits one company after five applications in an hour", async () => {
		const { t } = await setup();
		await withOpenSemester(t);

		for (let i = 0; i < 5; i += 1) await submitWith(t);
		const message = await refusalMessageFrom(submitWith(t));

		expect(message).toBe("Det er sendt mange søknader på kort tid. Prøv igjen senere.");
		expect(await applications(t)).toHaveLength(5);
	});
});
