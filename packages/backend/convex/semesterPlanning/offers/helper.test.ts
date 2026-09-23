import { describe, expect, it } from "vitest";
import { insertApplication, insertSemester, insertUser, setup } from "../../../test/fixtures";
import { supersedePendingOffers } from "./helper";

describe("supersedePendingOffers", () => {
	it("closes only pending offers", async () => {
		const { t } = await setup();
		const editor = await insertUser(t, "kari@ifinavet.no");
		const semesterId = await insertSemester(t);
		const applicationId = await insertApplication(t, semesterId, { status: "offer_sent" });

		const offerFields = {
			applicationId,
			date: "2027-02-09",
			eventType: "standard_presentation" as const,
			maxStudents: 40,
			sentAt: Date.now(),
			sentBy: editor._id,
		};
		const [pendingId, acceptedId] = await t.run(async (ctx) => [
			await ctx.db.insert("companyApplicationOffers", {
				...offerFields,
				tokenHash: "a",
				status: "pending",
			}),
			await ctx.db.insert("companyApplicationOffers", {
				...offerFields,
				tokenHash: "b",
				status: "accepted",
			}),
		]);

		const count = await t.run((ctx) => supersedePendingOffers(ctx, applicationId));

		expect(count).toBe(1);
		const [pending, accepted] = await t.run(async (ctx) => [
			await ctx.db.get(pendingId),
			await ctx.db.get(acceptedId),
		]);
		expect(pending?.status).toBe("superseded");
		expect(accepted?.status).toBe("accepted");
	});
});
