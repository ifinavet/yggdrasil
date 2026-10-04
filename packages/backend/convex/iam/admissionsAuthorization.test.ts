import { expect, it } from "vitest";
import { asUser, grantRole, insertStudent, insertUser, setup } from "../../test/fixtures";
import { api } from "../_generated/api";

const application = {
	firstName: "Kari",
	lastName: "Nordmann",
	uioEmail: "kari@uio.no",
	workspaceEmail: "kari@ifinavet.no",
	group: "Bedrift",
};

it("keeps onboarding admin-only for unauthenticated, student, and internal callers", async () => {
	const { t } = await setup();
	const student = await insertUser(t, "student@uio.no");
	await insertStudent(t, student._id);
	const internal = await insertUser(t, "internal@ifinavet.no");
	await grantRole(t, internal._id, "internal");
	const admin = await insertUser(t, "admin@ifinavet.no");
	await grantRole(t, admin._id, "admin");

	await expect(t.mutation(api.iam.mutations.startOnboarding, application)).rejects.toThrow(
		/Unauthorized/,
	);
	await expect(
		asUser(t, student).mutation(api.iam.mutations.startOnboarding, application),
	).rejects.toThrow(/Unauthorized/);
	await expect(
		asUser(t, internal).mutation(api.iam.mutations.startOnboarding, application),
	).rejects.toThrow(/Unauthorized/);

	expect(await t.run((ctx) => ctx.db.query("memberAccounts").collect())).toHaveLength(0);

	const result = await asUser(t, admin).mutation(api.iam.mutations.startOnboarding, application);
	expect(result).toMatchObject({ activated: false });
	expect(await t.run((ctx) => ctx.db.query("memberAccounts").collect())).toHaveLength(1);
});
