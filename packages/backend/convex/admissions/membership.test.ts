import { expect, it } from "vitest";
import { periodFields } from "../../test/admissions-fixtures";
import { insertUser, setup } from "../../test/fixtures";
import { internal } from "../_generated/api";

it("stores bounded Slack-managed ids only for the current open period revision", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const periodId = await t.run((ctx) => ctx.db.insert("admissionPeriods", periodFields(admin._id)));
	const args = { periodId, expectedRevision: 1, memberIds: ["U-old", "U-old"] };

	await t.mutation(internal.admissions.internal.saveSlackManagedMembers, args);
	await expect(t.run((ctx) => ctx.db.get(periodId))).resolves.toMatchObject({
		slackManagedMemberIds: ["U-old"],
	});
	await expect(
		t.mutation(internal.admissions.internal.saveSlackManagedMembers, {
			...args,
			expectedRevision: 2,
		}),
	).rejects.toThrow(/endret/i);
	await expect(
		t.mutation(internal.admissions.internal.saveSlackManagedMembers, {
			...args,
			memberIds: Array.from({ length: 61 }, (_, index) => `U-${index}`),
		}),
	).rejects.toThrow(/medlemslisten/i);
});

it("allows an already-running close notice to persist Slack membership before archival", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const periodId = await t.run((ctx) =>
		ctx.db.insert("admissionPeriods", periodFields(admin._id, { status: "closing", revision: 2 })),
	);

	await expect(
		t.mutation(internal.admissions.internal.saveSlackManagedMembers, {
			periodId,
			expectedRevision: 1,
			memberIds: ["U-interviewer"],
		}),
	).resolves.toBeNull();
	await expect(t.run((ctx) => ctx.db.get(periodId))).resolves.toMatchObject({
		slackManagedMemberIds: ["U-interviewer"],
	});
});
