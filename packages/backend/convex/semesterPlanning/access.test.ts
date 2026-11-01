import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertInternal,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
	type TestUser,
} from "../../test/fixtures";
import { api } from "../_generated/api";
import type { AccessRole } from "../auth/accessRights";

const access = api.semesterPlanning.access;

async function internal(
	t: TestBackend,
	email: string,
	group: string,
	role: AccessRole = "internal",
) {
	const user = await insertUser(t, email);
	await grantRole(t, user._id, role);
	const internalId = await insertInternal(t, user._id, "Intern", { group });
	return { ...user, internalId };
}

async function rightsOf(t: TestBackend, user: TestUser) {
	return await asUser(t, user).query(access.myRights, {});
}

function tryToPlan(t: TestBackend, user: TestUser) {
	return asUser(t, user).mutation(api.semesterPlanning.semesters.mutations.create, {
		year: 2030,
		term: "spring",
	});
}

describe("semester plan access", () => {
	it("lets the board, its linked logins and super-admins plan, and refuses editors and admins", async () => {
		const { t } = await setup();
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
		const editor = await internal(t, "editor@ifinavet.no", "Arrangement", "editor");
		const admin = await internal(t, "admin@ifinavet.no", "Web", "admin");
		const superAdmin = await insertUser(t, "web@ifinavet.no");
		await grantRole(t, superAdmin._id, "super-admin");
		const personal = await insertUser(t, "kari.nordmann@uio.no");
		await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "leder@ifinavet.no",
				uioEmail: "kari.nordmann@uio.no",
				firstName: "Kari",
				lastName: "Nordmann",
				group: "Styret",
				stage: "active",
				google: "existing",
				userId: leader._id,
				updatedAt: Date.now(),
			}),
		);

		for (const user of [leader, superAdmin, personal]) {
			expect(await rightsOf(t, user)).toEqual({ canPlan: true, canManageAccess: true });
		}
		await expect(tryToPlan(t, leader)).resolves.toBeDefined();
		for (const user of [editor, admin]) {
			expect(await rightsOf(t, user)).toEqual({ canPlan: false, canManageAccess: false });
			expect(await refusalMessageFrom(tryToPlan(t, user))).toContain("Unauthorized");
		}
	});

	it("lets the board give and take away access to plan, but not to manage access", async () => {
		const { t } = await setup();
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
		const member = await internal(t, "kari@ifinavet.no", "Bedrift");

		await asUser(t, leader).mutation(access.setPlanners, { internalIds: [member.internalId] });
		expect(await rightsOf(t, member)).toEqual({ canPlan: true, canManageAccess: false });
		await expect(tryToPlan(t, member)).resolves.toBeDefined();
		expect(
			await refusalMessageFrom(asUser(t, member).mutation(access.setPlanners, { internalIds: [] })),
		).toContain("Unauthorized");

		await asUser(t, leader).mutation(access.setPlanners, { internalIds: [] });
		expect(await rightsOf(t, member)).toEqual({ canPlan: false, canManageAccess: false });
	});

	it("lets only a super-admin move someone into or out of the board", async () => {
		const { t } = await setup();
		const admin = await internal(t, "admin@ifinavet.no", "Web", "admin");
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
		const superAdmin = await insertUser(t, "web@ifinavet.no");
		await grantRole(t, superAdmin._id, "super-admin");
		const updateInternal = api.users.organization.mutations.updateInternal;

		for (const change of [
			{ id: admin.internalId, group: "Styret" },
			{ id: leader.internalId, group: "Web" },
		]) {
			expect(await refusalMessageFrom(asUser(t, admin).mutation(updateInternal, change))).toContain(
				"Bare super-admin",
			);
		}
		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.startOnboarding, {
					firstName: "Kari",
					lastName: "Nordmann",
					uioEmail: "kari@uio.no",
					workspaceEmail: "kari@ifinavet.no",
					group: "Styret",
				}),
			),
		).toContain("Bare super-admin");

		await asUser(t, admin).mutation(updateInternal, { id: admin.internalId, group: "Bedrift" });
		await asUser(t, superAdmin).mutation(updateInternal, { id: admin.internalId, group: "Styret" });
		expect(await rightsOf(t, admin)).toEqual({ canPlan: true, canManageAccess: true });
	});
});
