import { expect, it } from "vitest";
import { periodFields } from "../../../test/admissions-fixtures";
import { asUser, grantRole, insertUser, setup } from "../../../test/fixtures";
import { api } from "../../_generated/api";

it("lets signed-in applicants read only group ids and names", async () => {
	const { t } = await setup();
	const student = await insertUser(t, "student@uio.no");
	const outsider = await insertUser(t, "outsider@example.test");
	const groupId = await t.run((ctx) =>
		ctx.db.insert("internalGroups", {
			name: "Web",
			description: "Private internal description",
		}),
	);

	await expect(
		asUser(t, student).query(api.admissions.queries.availableGroups, {}),
	).resolves.toEqual([{ _id: groupId, name: "Web" }]);
	await expect(
		asUser(t, outsider).query(api.admissions.queries.availableGroups, {}),
	).resolves.toEqual([{ _id: groupId, name: "Web" }]);
	await expect(t.query(api.admissions.queries.availableGroups, {})).rejects.toThrow(/Unauthorized/);
});

it("keeps group management admin-only and prevents deleting a referenced group", async () => {
	const { t } = await setup();
	const student = await insertUser(t, "student@uio.no");
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const studentClient = asUser(t, student);
	const adminClient = asUser(t, admin);

	await expect(
		studentClient.mutation(api.users.organization.groups.create, {
			name: "Web",
			description: "",
		}),
	).rejects.toThrow(/Unauthorized/);

	const groupId = await adminClient.mutation(api.users.organization.groups.create, {
		name: "Web",
		description: "Web group",
	});
	await adminClient.mutation(api.users.organization.groups.update, {
		groupId,
		name: "Web",
		description: "Updated description",
		leader: null,
	});
	const periodId = await t.run((ctx) => ctx.db.insert("admissionPeriods", periodFields(admin._id)));
	await t.run((ctx) =>
		ctx.db.insert("admissionApplications", {
			periodId,
			userId: student._id,
			group: groupId,
			availability: [],
			status: "draft",
			revision: 1,
			decisionRevision: 0,
			decision: "pending",
			offerStatus: "none",
			sent: false,
		}),
	);
	await expect(
		adminClient.mutation(api.users.organization.groups.remove, { groupId }),
	).rejects.toThrow(/Flytt medlemmer/);
	await expect(adminClient.query(api.users.organization.groups.list, {})).resolves.toMatchObject([
		{ _id: groupId, name: "Web", description: "Updated description" },
	]);
});
