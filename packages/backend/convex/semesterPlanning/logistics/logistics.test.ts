import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertApplication,
	insertSemester,
	insertUser,
	refusalMessageFrom,
	setup,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";

const createEvent = api.semesterPlanning.applications.mutations.createEvent;
const logistics = api.semesterPlanning.logistics;

const DETAILS = {
	title: "Bedriftspresentasjon",
	teaser: "Kom og hør.",
	description: "Presentasjon og mat.",
	eventStart: Date.parse("2027-02-09T15:15:00Z"),
	registrationOpens: Date.parse("2027-01-26T11:00:00Z"),
	participationLimit: 40,
	location: "Simula",
	food: "Pizza",
	language: "Norsk",
	ageRestriction: "Ingen",
	published: false,
};
type Answers = Pick<Doc<"companyApplications">, "venue" | "foodAndDrinks" | "foodPurchasedBy">;

async function eventFrom(answers: Answers) {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	const member = await insertUser(t, "emil@ifinavet.no");
	await grantRole(t, member._id, "internal");
	const semesterId = await insertSemester(t);
	const applicationId = await insertApplication(t, semesterId, {
		status: "confirmed",
		assignedDate: "2027-02-09",
		// The org.nr. of the fixture's company profile.
		orgNumber: "123456789",
		...answers,
	});
	const eventId = await asUser(t, editorUser).mutation(createEvent, {
		applicationId,
		...DETAILS,
		hostingCompany: companyId,
		organizers: [],
	});
	return { t, eventId, member: asUser(t, member) };
}

describe("event logistics", () => {
	it.each([
		{
			case: "on campus, Navet buys the food",
			answers: { venue: "campus", foodAndDrinks: true, foodPurchasedBy: "navet" },
			needs: { roomNeeded: true, foodNeeded: true },
		},
		{
			case: "undecided venue and buyer",
			answers: { venue: "undecided", foodAndDrinks: true, foodPurchasedBy: "undecided" },
			needs: { roomNeeded: true, foodNeeded: true },
		},
		{
			case: "own premises, the company buys the food",
			answers: { venue: "own_premises", foodAndDrinks: true, foodPurchasedBy: "company" },
			needs: { roomNeeded: false, foodNeeded: false },
		},
		{
			case: "no food at all",
			answers: { venue: "campus", foodAndDrinks: false, foodPurchasedBy: "navet" },
			needs: { roomNeeded: true, foodNeeded: false },
		},
	] as const)("follows the company's answers: $case", async ({ answers, needs }) => {
		const { eventId, member } = await eventFrom(answers);

		expect(await member.query(logistics.queries.getForEvent, { eventId })).toEqual({
			...needs,
			roomBooked: false,
			foodOrdered: false,
		});
	});

	it("lets an internal member tick off the room and the food", async () => {
		const { eventId, member } = await eventFrom({
			venue: "campus",
			foodAndDrinks: true,
			foodPurchasedBy: "navet",
		});

		await member.mutation(logistics.mutations.update, { eventId, roomBooked: true });
		await member.mutation(logistics.mutations.update, { eventId, foodOrdered: true });

		expect(await member.query(logistics.queries.getForEvent, { eventId })).toMatchObject({
			roomBooked: true,
			foodOrdered: true,
		});
	});

	it("has nothing for an event not created from an application", async () => {
		const { t, member } = await eventFrom({
			venue: "campus",
			foodAndDrinks: true,
			foodPurchasedBy: "navet",
		});
		const otherId = await t.run(async (ctx) => {
			const company = await ctx.db.query("companies").first();
			if (!company) throw new Error("Expected the fixture's company.");
			return ctx.db.insert("events", {
				...DETAILS,
				externalEvent: false,
				hostingCompany: company._id,
			});
		});

		expect(await member.query(logistics.queries.getForEvent, { eventId: otherId })).toBeNull();
		expect(
			await refusalMessageFrom(
				member.mutation(logistics.mutations.update, { eventId: otherId, roomBooked: true }),
			),
		).toBe("Arrangementet har ingen praktiske oppgaver.");
	});

	it("refuses people who are not internal members", async () => {
		const { t, eventId } = await eventFrom({
			venue: "campus",
			foodAndDrinks: true,
			foodPurchasedBy: "navet",
		});
		const student = await insertUser(t, "student@uio.no");

		expect(
			await refusalMessageFrom(
				asUser(t, student).mutation(logistics.mutations.update, { eventId, roomBooked: true }),
			),
		).toContain("Unauthorized");
	});
});
