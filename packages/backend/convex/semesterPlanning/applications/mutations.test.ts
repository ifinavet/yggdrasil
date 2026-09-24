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

const mutations = api.semesterPlanning.applications.mutations;

async function planningSetup() {
	const { t, companyId } = await setup();
	const editorUser = await insertUser(t, "kari@ifinavet.no");
	await grantRole(t, editorUser._id, "editor");
	const semesterId = await insertSemester(t, { status: "open" });
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
	return { t, companyId, semesterId, editorUser, editor: asUser(t, editorUser) };
}

async function insertOffer(
	t: TestBackend,
	applicationId: Id<"companyApplications">,
	sentBy: Id<"users">,
	status: "pending" | "accepted" = "pending",
) {
	return t.run((ctx) =>
		ctx.db.insert("companyApplicationOffers", {
			applicationId,
			date: "2027-02-09",
			eventType: "standard_presentation",
			maxStudents: 40,
			linkToken: `token-${Math.random()}`,
			sentAt: Date.now(),
			sentBy,
			status,
		}),
	);
}

describe("assignDate", () => {
	it("gives the date, logs it, and reports a date the company did not tick", async () => {
		const { t, semesterId, editor, editorUser } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId);

		const ticked = await editor.mutation(mutations.assignDate, {
			applicationId,
			date: "2027-02-09",
		});
		expect(ticked).toEqual({ outsideAvailable: false });
		expect((await applicationById(t, applicationId)).assignedDate).toBe("2027-02-09");

		const unticked = await editor.mutation(mutations.assignDate, {
			applicationId,
			date: "2027-02-11",
		});
		expect(unticked).toEqual({ outsideAvailable: true });

		const history = await activityFor(t, applicationId);
		expect(history.map((row) => [row.type, row.date, row.actorUserId])).toEqual([
			["date_assigned", "2027-02-09", editorUser._id],
			["date_assigned", "2027-02-11", editorUser._id],
		]);
	});

	it("does nothing when the date is unchanged", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, { assignedDate: "2027-02-09" });

		await editor.mutation(mutations.assignDate, { applicationId, date: "2027-02-09" });

		expect(await activityFor(t, applicationId)).toHaveLength(0);
	});

	it("refuses a date another live company holds, and names it", async () => {
		const { t, semesterId, editor } = await planningSetup();
		await insertApplication(t, semesterId, {
			status: "offer_sent",
			assignedDate: "2027-02-09",
			registry: {
				name: "HAVBRIS AS",
				organizationForm: { code: "AS", description: "Aksjeselskap" },
				fetchedAt: 0,
			},
		});
		const applicationId = await insertApplication(t, semesterId);

		const message = await refusalMessageFrom(
			editor.mutation(mutations.assignDate, { applicationId, date: "2027-02-09" }),
		);
		expect(message).toBe("Datoen er allerede tildelt HAVBRIS AS.");
	});

	it("lets two editors race for a date, and only the first wins", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const first = await insertApplication(t, semesterId);
		const second = await insertApplication(t, semesterId);

		const results = await Promise.allSettled([
			editor.mutation(mutations.assignDate, { applicationId: first, date: "2027-02-16" }),
			editor.mutation(mutations.assignDate, { applicationId: second, date: "2027-02-16" }),
		]);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		const holders = await t.run((ctx) =>
			ctx.db
				.query("companyApplications")
				.withIndex("by_semesterId_and_assignedDate", (q) =>
					q.eq("semesterId", semesterId).eq("assignedDate", "2027-02-16"),
				)
				.collect(),
		);
		expect(holders).toHaveLength(1);
	});

	it("allows a date that only a withdrawn company held", async () => {
		const { t, semesterId, editor } = await planningSetup();
		await insertApplication(t, semesterId, { status: "withdrawn", assignedDate: "2027-02-09" });
		const applicationId = await insertApplication(t, semesterId);

		await editor.mutation(mutations.assignDate, { applicationId, date: "2027-02-09" });
		expect((await applicationById(t, applicationId)).assignedDate).toBe("2027-02-09");
	});

	it.each([
		["a closed date", "2027-01-19", "Datoen er stengt: Kickoff."],
		["a date outside the semester", "2027-08-17", "Datoen finnes ikke i semesteret."],
		["an invalid date", "9. februar", "Ugyldig dato."],
	])("refuses %s", async (_case, date, expected) => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId);

		expect(
			await refusalMessageFrom(editor.mutation(mutations.assignDate, { applicationId, date })),
		).toBe(expected);
	});

	it("never moves a confirmed application", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2027-02-09",
		});

		for (const date of ["2027-02-16", null]) {
			const message = await refusalMessageFrom(
				editor.mutation(mutations.assignDate, { applicationId, date }),
			);
			expect(message).toBe(
				"Bekreftede søknader kan ikke flyttes. Trekk og gjenåpne søknaden først.",
			);
		}
		expect((await applicationById(t, applicationId)).assignedDate).toBe("2027-02-09");
	});

	it("refuses withdrawn applications and closed semesters", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const withdrawn = await insertApplication(t, semesterId, { status: "withdrawn" });
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.assignDate, { applicationId: withdrawn, date: "2027-02-09" }),
			),
		).toBe("Søknaden er trukket eller avslått.");

		const closedSemesterId = await insertSemester(t, {
			year: 2026,
			term: "autumn",
			status: "closed",
		});
		const old = await insertApplication(t, closedSemesterId);
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.assignDate, { applicationId: old, date: "2027-02-09" }),
			),
		).toBe("Semesteret er stengt.");
	});

	it("moving an application with an open offer cancels the offer and goes back to «Søkt»", async () => {
		const { t, semesterId, editor, editorUser } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, {
			status: "offer_sent",
			assignedDate: "2027-02-09",
		});
		const offerId = await insertOffer(t, applicationId, editorUser._id);

		await editor.mutation(mutations.assignDate, { applicationId, date: "2027-02-16" });

		const application = await applicationById(t, applicationId);
		expect([application.status, application.assignedDate]).toEqual(["applied", "2027-02-16"]);
		expect((await t.run((ctx) => ctx.db.get(offerId)))?.status).toBe("superseded");
		const history = await activityFor(t, applicationId);
		expect(history.map((row) => [row.type, row.fromStatus, row.toStatus])).toEqual([
			["status_changed", "offer_sent", "applied"],
			["date_assigned", undefined, undefined],
		]);
	});

	it("clearing the date logs the old date and cancels an open offer", async () => {
		const { t, semesterId, editor, editorUser } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, {
			status: "new_date_requested",
			assignedDate: "2027-02-09",
		});
		await insertOffer(t, applicationId, editorUser._id);

		await editor.mutation(mutations.assignDate, { applicationId, date: null });

		const application = await applicationById(t, applicationId);
		expect([application.status, application.assignedDate]).toEqual(["applied", undefined]);
		const history = await activityFor(t, applicationId);
		expect(history.at(-1)).toMatchObject({ type: "date_cleared", date: "2027-02-09" });
	});

	it("is editor-only", async () => {
		const { t, semesterId } = await planningSetup();
		const member = await insertUser(t, "medlem@ifinavet.no");
		await grantRole(t, member._id, "internal");
		const applicationId = await insertApplication(t, semesterId);

		const message = await refusalMessageFrom(
			asUser(t, member).mutation(mutations.assignDate, { applicationId, date: "2027-02-09" }),
		);
		expect(message).toContain("Unauthorized");
	});
});

describe("reject, withdraw and reopen", () => {
	it("rejects an application and cancels its offer", async () => {
		const { t, semesterId, editor, editorUser } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, { status: "new_date_requested" });
		const offerId = await insertOffer(t, applicationId, editorUser._id);

		await editor.mutation(mutations.reject, { applicationId, comment: "Ingen ledige datoer." });

		expect((await applicationById(t, applicationId)).status).toBe("rejected");
		expect((await t.run((ctx) => ctx.db.get(offerId)))?.status).toBe("superseded");
		expect((await activityFor(t, applicationId)).at(-1)?.comment).toBe("Ingen ledige datoer.");
	});

	it("refuses to reject a confirmed application", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, { status: "confirmed" });

		expect(await refusalMessageFrom(editor.mutation(mutations.reject, { applicationId }))).toBe(
			"Kan ikke gå fra «Bekreftet» til «Avslått».",
		);
	});

	it("withdrawing a confirmed application frees its date for another company", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const confirmed = await insertApplication(t, semesterId, {
			status: "confirmed",
			assignedDate: "2027-02-09",
		});
		const waiting = await insertApplication(t, semesterId);

		await editor.mutation(mutations.withdraw, { applicationId: confirmed });
		await editor.mutation(mutations.assignDate, { applicationId: waiting, date: "2027-02-09" });

		expect((await applicationById(t, confirmed)).status).toBe("withdrawn");
		expect((await applicationById(t, confirmed)).assignedDate).toBe("2027-02-09");
		expect((await applicationById(t, waiting)).assignedDate).toBe("2027-02-09");
	});

	it("reopening clears the old date", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId, {
			status: "withdrawn",
			assignedDate: "2027-02-09",
		});

		await editor.mutation(mutations.reopen, { applicationId });

		const application = await applicationById(t, applicationId);
		expect([application.status, application.assignedDate]).toEqual(["applied", undefined]);
	});

	it("refuses to reopen a live application", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId);

		expect(await refusalMessageFrom(editor.mutation(mutations.reopen, { applicationId }))).toBe(
			"Kan ikke gå fra «Søkt» til «Søkt».",
		);
	});
});

describe("updatePlanningDetails", () => {
	it("saves the kontaktperson and notes, and clears notes with an empty string", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const member = await insertUser(t, "emil@ifinavet.no");
		await grantRole(t, member._id, "internal");
		const applicationId = await insertApplication(t, semesterId, { internalNotes: "Gammelt" });

		await editor.mutation(mutations.updatePlanningDetails, {
			applicationId,
			responsibleUserId: member._id,
			internalNotes: "Ring før 4. feb",
		});
		expect(await applicationById(t, applicationId)).toMatchObject({
			responsibleUserId: member._id,
			internalNotes: "Ring før 4. feb",
		});

		await editor.mutation(mutations.updatePlanningDetails, { applicationId, internalNotes: "" });
		expect((await applicationById(t, applicationId)).internalNotes).toBeUndefined();
		expect(await activityFor(t, applicationId)).toHaveLength(0);
	});

	it("refuses an org-ansvarlig who is not an internal member", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const student = await insertUser(t, "student@uio.no");
		const applicationId = await insertApplication(t, semesterId);

		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.updatePlanningDetails, {
					applicationId,
					responsibleUserId: student._id,
				}),
			),
		).toBe("Kontaktpersonen fra Navet må være et internt medlem.");
	});

	it("saves up to two internal medhjelpere, and clears them with an empty list", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const helpers = [];
		for (const email of ["a@ifinavet.no", "b@ifinavet.no", "c@ifinavet.no"]) {
			const user = await insertUser(t, email);
			await grantRole(t, user._id, "internal");
			helpers.push(user._id);
		}
		const [first, second, third] = helpers as [Id<"users">, Id<"users">, Id<"users">];
		const applicationId = await insertApplication(t, semesterId);

		await editor.mutation(mutations.updatePlanningDetails, {
			applicationId,
			helperUserIds: [first, second],
		});
		expect((await applicationById(t, applicationId)).helperUserIds).toEqual([first, second]);

		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.updatePlanningDetails, {
					applicationId,
					helperUserIds: [first, second, third],
				}),
			),
		).toBe("Et arrangement kan ha høyst 2 medhjelpere.");
		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.updatePlanningDetails, {
					applicationId,
					helperUserIds: [first, first],
				}),
			),
		).toBe("Samme person er valgt som medhjelper to ganger.");

		await editor.mutation(mutations.updatePlanningDetails, { applicationId, helperUserIds: [] });
		expect((await applicationById(t, applicationId)).helperUserIds).toBeUndefined();
	});

	it("refuses a medhjelper who is not an internal member", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const student = await insertUser(t, "student@uio.no");
		const applicationId = await insertApplication(t, semesterId);

		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.updatePlanningDetails, {
					applicationId,
					helperUserIds: [student._id],
				}),
			),
		).toBe("Medhjelperne må være interne medlemmer.");
	});

	it("refuses team changes once the event exists, but still saves notes", async () => {
		const { t, semesterId, editor, companyId } = await planningSetup();
		const member = await insertUser(t, "emil@ifinavet.no");
		await grantRole(t, member._id, "internal");
		const eventId = await t.run((ctx) =>
			ctx.db.insert("events", {
				title: "Fjordkode",
				teaser: "",
				description: "",
				eventStart: Date.parse("2027-02-09T15:15:00Z"),
				registrationOpens: Date.parse("2027-01-26T11:00:00Z"),
				participationLimit: 40,
				location: "Simula",
				food: "Pizza",
				language: "Norsk",
				ageRestriction: "Ingen",
				externalEvent: false,
				hostingCompany: companyId,
				published: false,
			}),
		);
		const applicationId = await insertApplication(t, semesterId, { eventId });

		for (const change of [{ responsibleUserId: member._id }, { helperUserIds: [member._id] }]) {
			expect(
				await refusalMessageFrom(
					editor.mutation(mutations.updatePlanningDetails, { applicationId, ...change }),
				),
			).toBe("Arrangementet er opprettet. Endre kontaktperson og medhjelpere på arrangementet.");
		}
		await editor.mutation(mutations.updatePlanningDetails, { applicationId, internalNotes: "Ok" });
		expect((await applicationById(t, applicationId)).internalNotes).toBe("Ok");
	});
});

describe("updateContact", () => {
	it("replaces the contact person and logs the change", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId);

		await editor.mutation(mutations.updateContact, {
			applicationId,
			contact: { name: " Per Aas ", email: "per@fjordkode.no", phone: "+47 900 00 000" },
		});

		expect((await applicationById(t, applicationId)).contact).toEqual({
			name: "Per Aas",
			email: "per@fjordkode.no",
			phone: "+47 900 00 000",
		});
		expect((await activityFor(t, applicationId)).at(-1)).toMatchObject({
			type: "contact_changed",
			comment: "Ingrid Solberg → Per Aas",
		});
	});

	it("uses the same rules as the Hugin form", async () => {
		const { t, semesterId, editor } = await planningSetup();
		const applicationId = await insertApplication(t, semesterId);

		expect(
			await refusalMessageFrom(
				editor.mutation(mutations.updateContact, {
					applicationId,
					contact: { name: "Per", email: "ikke-epost", phone: "+4790000000" },
				}),
			),
		).toBe("Skriv en gyldig e-postadresse til kontaktpersonen.");
	});
});
