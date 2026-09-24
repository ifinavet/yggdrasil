import { MIDGARD_URL } from "@workspace/shared/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	activityFor,
	applicationById,
	asUser,
	grantRole,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../test/fixtures";
import { stubRegistries, VALID_ORG_NUMBER } from "../../test/registryFetch";
import { api } from "../_generated/api";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("the whole journey", () => {
	it("goes from a Hugin application to an event, with the full history", async () => {
		// Before spring 2027 ends, so the semester can still be opened.
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.parse("2027-01-10T12:00:00Z"));
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
			termsUrl: `${MIDGARD_URL}/vilkar`,
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
				billing: { email: "faktura@fjordkode.no" },
				targetDegrees: [],
				targetStudyPrograms: [],
				consent: true,
			},
		});
		const [application] = await t.run((ctx) => ctx.db.query("companyApplications").collect());
		const applicationId = application?._id;
		if (!applicationId) throw new Error("The application was not saved.");

		// Navet copies the offer link from Bifrost and emails it by hand.
		// First offer; the company asks for another date.
		await editor.mutation(applications.assignDate, { applicationId, date: "2027-02-09" });
		const firstOffer = await editor.mutation(offers.sendOffer, { applicationId });
		await t.mutation(offers.requestNewDate, {
			token: firstOffer.linkToken,
			dates: ["2027-02-16"],
		});

		// Second offer; the company accepts, and the first link can no longer undo that.
		await editor.mutation(applications.assignDate, { applicationId, date: "2027-02-16" });
		const secondOffer = await editor.mutation(offers.sendOffer, { applicationId });
		await t.mutation(offers.accept, { token: secondOffer.linkToken, acceptTerms: true });
		expect(
			await refusalMessageFrom(t.mutation(offers.decline, { token: firstOffer.linkToken })),
		).toBe("Tilbudet gjelder ikke lenger.");

		// The editor creates the event, hosted by the company profile with the same org.nr.
		await t.run((ctx) => ctx.db.patch(companyId, { orgNumber: Number(VALID_ORG_NUMBER) }));
		const eventId = await editor.mutation(applications.createEvent, {
			applicationId,
			title: "Fjordkode",
			teaser: "Presentasjon",
			description: "Presentasjon og kodeoppgave.",
			eventStart: Date.parse("2027-02-16T15:15:00Z"),
			registrationOpens: Date.parse("2027-02-02T11:00:00Z"),
			participationLimit: 40,
			location: "Simula",
			food: "Pizza",
			language: "Norsk",
			ageRestriction: "Ingen",
			hostingCompany: companyId,
			published: false,
			organizers: [],
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
			"event_linked internal ",
		]);
	});
});
