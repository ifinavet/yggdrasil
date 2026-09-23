import { toCsv } from "@workspace/shared/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
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
} from "../../test/fixtures";
import { stubRegistries, VALID_ORG_NUMBER } from "../../test/registryFetch";
import { api } from "../_generated/api";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("toCsv", () => {
	it("adds a byte order mark, quotes where needed and keeps æøå", () => {
		expect(
			toCsv([
				["Bedrift", "Rom"],
				["Bølge, Helse AS", 'Rom "A"'],
				["Ås", null],
			]),
		).toBe('\uFEFFBedrift,Rom\r\n"Bølge, Helse AS","Rom ""A"""\r\nÅs,');
	});
});

describe("exportRows", () => {
	it("has the Excel columns and one row per Tuesday and Thursday", async () => {
		const { t } = await setup();
		const editor = await insertUser(t, "kari@ifinavet.no");
		await grantRole(t, editor._id, "editor");
		const organizer = await insertUser(t, "emil@ifinavet.no", {
			firstName: "Emil",
			lastName: "Moe",
		});
		const semesterId = await insertSemester(t);
		await t.run(async (ctx) => {
			await ctx.db.insert("semesterDates", {
				semesterId,
				date: "2027-01-19",
				closedLabel: "Kickoff",
			});
			await ctx.db.insert("semesterDates", { semesterId, date: "2027-01-21" });
			await ctx.db.insert("semesterDates", { semesterId, date: "2027-02-09" });
		});
		await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2027-02-09",
			responsibleUserId: organizer._id,
			room: "Simula",
			roomBooked: true,
		});
		await insertApplication(t, semesterId, { status: "withdrawn", assignedDate: "2027-01-21" });

		const { filename, csv } = await asUser(t, editor).query(
			api.semesterPlanning.applications.queries.exportRows,
			{
				semesterId,
			},
		);

		expect(filename).toBe("semesterplan-varen-2027.csv");
		expect(csv.startsWith("\uFEFF")).toBe(true);
		expect(csv.slice(1).split("\r\n")).toEqual([
			"Dag,Dato,Bekreftet,Bedrift,Sendt tilbud,Org.nummer,Arr.type,Kontaktperson,Epost,Mat,Mat bestilt,Ønsker Escape,Rom/Lokasjon,Rom booket,Org-ansvarlig,Antall plasser",
			"tirsdag,19.01,,Kickoff (internt),,,,,,,,,,,,",
			"torsdag,21.01,,Ledig,,,,,,,,,,,,",
			"tirsdag,9.02,Ja,FJORDKODE AS,Ja,924773189,Ordinær bedriftspresentasjon,Ingrid Solberg,ingrid@fjordkode.no,Ja,Nei,Usikker,Simula,Ja,Emil Moe,40",
		]);
	});

	it("is editor-only", async () => {
		const { t } = await setup();
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");
		const semesterId = await insertSemester(t);

		expect(
			await refusalMessageFrom(
				asUser(t, member).query(api.semesterPlanning.applications.queries.exportRows, {
					semesterId,
				}),
			),
		).toContain("Unauthorized");
	});
});

describe("the whole journey", () => {
	it("goes from a Hugin application to an event, with the full history", async () => {
		const { t, companyId } = await setup();
		const editorUser = await insertUser(t, "kari@ifinavet.no");
		await grantRole(t, editorUser._id, "editor");
		const editor = asUser(t, editorUser);
		const semesters = api.semesterPlanning.semesters.mutations;
		const applications = api.semesterPlanning.applications.mutations;
		const offers = api.semesterPlanning.offers.mutations;

		// The editor sets up the semester by hand.
		const semesterId = await editor.mutation(semesters.create, { year: 2027, term: "spring" });
		await editor.mutation(semesters.setRange, {
			semesterId,
			firstDate: "2027-02-01",
			lastDate: "2027-02-28",
		});
		await editor.mutation(semesters.updateSettings, {
			semesterId,
			applicationDeadline: "2026-12-04",
			termsUrl: "https://ifinavet.no/vilkar",
		});
		await editor.mutation(semesters.setStatus, { semesterId, status: "open" });

		// The company applies on Hugin.
		stubRegistries();
		await t.action(api.semesterPlanning.applications.submit.submit, {
			submissionId: "journey-submission-1",
			form: {
				orgNumber: VALID_ORG_NUMBER,
				contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+47 412 34 567" },
				eventType: "standard_presentation",
				minStudents: 25,
				maxStudents: 40,
				description: "Presentasjon og kodeoppgave.",
				availableDates: ["2027-02-09", "2027-02-16"],
				venue: "campus",
				wantsToUseEscape: "no",
				foodAndDrinks: true,
				foodPurchasedBy: "company",
				billing: { email: "faktura@fjordkode.no", ehf: true },
				targetDegrees: [],
				targetStudyPrograms: [],
				consent: true,
			},
		});
		const [application] = await t.run((ctx) => ctx.db.query("companyApplications").collect());
		const applicationId = application?._id;
		if (!applicationId) throw new Error("The application was not saved.");

		const tokenOfLatestOffer = async () => {
			const emails = (await scheduledCallsOf(t, "sendOfferEmail")) as { url: string }[];
			const url = emails.at(-1)?.url ?? "";
			return url.slice(url.lastIndexOf("/") + 1);
		};

		// First offer; the company asks for another date.
		await editor.mutation(applications.assignDate, { applicationId, date: "2027-02-09" });
		await editor.mutation(offers.send, { applicationId });
		await t.mutation(offers.requestNewDate, {
			token: await tokenOfLatestOffer(),
			dates: ["2027-02-16"],
		});

		// Second offer; the company accepts.
		await editor.mutation(applications.assignDate, { applicationId, date: "2027-02-16" });
		await editor.mutation(offers.send, { applicationId });
		await t.mutation(offers.accept, { token: await tokenOfLatestOffer(), acceptTerms: true });

		// The editor links the company profile and creates the event.
		await t.run((ctx) => ctx.db.patch(companyId, { orgNumber: Number(VALID_ORG_NUMBER) }));
		await editor.mutation(applications.linkCompany, { applicationId, companyId });
		const eventId = await editor.mutation(applications.createEvent, {
			applicationId,
			title: "Fjordkode",
			teaser: "Presentasjon",
			description: "Presentasjon og kodeoppgave.",
			startTime: "16:15",
			registrationOpens: Date.parse("2027-02-02T11:00:00Z"),
			location: "Simula",
			food: "Pizza",
			language: "Norsk",
			ageRestriction: "Ingen",
		});

		const final = await applicationById(t, applicationId);
		expect(final).toMatchObject({
			status: "confirmed",
			assignedDate: "2027-02-16",
			companyId,
			eventId,
		});
		expect((await t.run((ctx) => ctx.db.get(eventId)))?.eventStart).toBe(
			Date.parse("2027-02-16T15:15:00Z"),
		);

		const history = (await activityFor(t, applicationId)).map((row) =>
			[row.type, row.actor, row.toStatus ?? row.date ?? ""].join(" "),
		);
		expect(history).toEqual([
			"submitted company ",
			"date_assigned internal 2027-02-09",
			"status_changed internal offer_sent",
			"status_changed company new_date_requested",
			"status_changed internal applied",
			"date_assigned internal 2027-02-16",
			"status_changed internal offer_sent",
			"status_changed company confirmed",
			"company_linked internal ",
			"event_linked internal ",
		]);
	});
});
