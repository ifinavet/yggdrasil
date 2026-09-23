import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import {
	activityFor,
	applicationById,
	insertApplication,
	insertSemester,
	insertUser,
	setup,
} from "../../test/fixtures";
import {
	findActiveApplicationOnDate,
	logApplicationActivity,
	transitionApplicationStatus,
} from "./applicationLifecycle";

describe("transitionApplicationStatus", () => {
	it("changes the status and writes exactly one history row", async () => {
		const { t } = await setup();
		const editor = await insertUser(t, "kari@ifinavet.no");
		const semesterId = await insertSemester(t);
		const applicationId = await insertApplication(t, semesterId);

		await t.run(async (ctx) => {
			const application = await ctx.db.get(applicationId);
			if (!application) throw new Error("missing");
			await transitionApplicationStatus(
				ctx,
				application,
				"rejected",
				{ type: "internal", userId: editor._id },
				{
					comment: "Ingen ledige datoer.",
				},
			);
		});

		expect((await applicationById(t, applicationId)).status).toBe("rejected");
		const history = await activityFor(t, applicationId);
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			type: "status_changed",
			actor: "internal",
			actorUserId: editor._id,
			fromStatus: "applied",
			toStatus: "rejected",
			comment: "Ingen ledige datoer.",
		});
	});

	it("patches extra fields together with the status", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t);
		const applicationId = await insertApplication(t, semesterId, {
			status: "offer_sent",
			assignedDate: "2027-02-09",
		});

		await t.run(async (ctx) => {
			const application = await ctx.db.get(applicationId);
			if (!application) throw new Error("missing");
			await transitionApplicationStatus(
				ctx,
				application,
				"applied",
				{ type: "system" },
				{
					patch: { assignedDate: undefined },
				},
			);
		});

		const application = await applicationById(t, applicationId);
		expect(application.status).toBe("applied");
		expect(application.assignedDate).toBeUndefined();
	});

	it("refuses a forbidden change in Norwegian and writes nothing", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t);
		const applicationId = await insertApplication(t, semesterId);

		const error = await t
			.run(async (ctx) => {
				const application = await ctx.db.get(applicationId);
				if (!application) throw new Error("missing");
				await transitionApplicationStatus(ctx, application, "confirmed", { type: "company" });
			})
			.catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ConvexError);
		expect(String((error as ConvexError<string>).data)).toBe(
			"Kan ikke gå fra «Søkt» til «Bekreftet».",
		);
		expect((await applicationById(t, applicationId)).status).toBe("applied");
		expect(await activityFor(t, applicationId)).toHaveLength(0);
	});
});

describe("logApplicationActivity", () => {
	it("records the actor without a user for companies and the system", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t);
		const applicationId = await insertApplication(t, semesterId);

		await t.run(async (ctx) => {
			await logApplicationActivity(ctx, applicationId, "submitted", { type: "company" });
			await logApplicationActivity(
				ctx,
				applicationId,
				"date_assigned",
				{ type: "system" },
				{ date: "2027-02-09" },
			);
		});

		const history = await activityFor(t, applicationId);
		expect(history.map((row) => [row.type, row.actor, row.actorUserId, row.date])).toEqual([
			["submitted", "company", undefined, undefined],
			["date_assigned", "system", undefined, "2027-02-09"],
		]);
	});
});

describe("findActiveApplicationOnDate", () => {
	it("finds the live application holding a date and ignores closed ones and the caller", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t);
		const otherSemesterId = await insertSemester(t, { year: 2027, term: "autumn" });
		await insertApplication(t, semesterId, { status: "withdrawn", assignedDate: "2027-02-09" });
		await insertApplication(t, otherSemesterId, {
			status: "confirmed",
			assignedDate: "2027-02-09",
		});
		const holderId = await insertApplication(t, semesterId, {
			status: "offer_sent",
			assignedDate: "2027-02-09",
		});

		const found = await t.run((ctx) => findActiveApplicationOnDate(ctx, semesterId, "2027-02-09"));
		expect(found?._id).toBe(holderId);

		const exceptSelf = await t.run((ctx) =>
			findActiveApplicationOnDate(ctx, semesterId, "2027-02-09", holderId),
		);
		expect(exceptSelf).toBeNull();

		expect(
			await t.run((ctx) => findActiveApplicationOnDate(ctx, semesterId, "2027-02-16")),
		).toBeNull();
	});
});
