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
	await insertInternal(t, user._id, "Intern", { group });
	return user;
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
	it("lets the board plan and manage access, and refuses editors and admins outside it", async () => {
		const { t } = await setup();
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
		const editor = await internal(t, "editor@ifinavet.no", "Arrangement", "editor");
		const admin = await internal(t, "admin@ifinavet.no", "Web", "admin");

		expect(await rightsOf(t, leader)).toEqual({ canPlan: true, canManageAccess: true });
		await expect(tryToPlan(t, leader)).resolves.toBeDefined();
		for (const user of [editor, admin]) {
			expect(await rightsOf(t, user)).toEqual({ canPlan: false, canManageAccess: false });
			expect(await refusalMessageFrom(tryToPlan(t, user))).toContain("Unauthorized");
		}
	});

	it("lets a super-admin plan and manage access without being on the board", async () => {
		const { t } = await setup();
		const superAdmin = await insertUser(t, "web@ifinavet.no");
		await grantRole(t, superAdmin._id, "super-admin");

		expect(await rightsOf(t, superAdmin)).toEqual({ canPlan: true, canManageAccess: true });
	});

	it("counts a login linked to a board member's account as the board member", async () => {
		const { t } = await setup();
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
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

		expect(await rightsOf(t, personal)).toEqual({ canPlan: true, canManageAccess: true });
	});

	it("lets the board give and take away access to plan, but not to manage access", async () => {
		const { t } = await setup();
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
		const member = await internal(t, "kari@ifinavet.no", "Bedrift");
		const other = await internal(t, "ola@ifinavet.no", "Bedrift");

		const grantId = await asUser(t, leader).mutation(access.grant, { userId: member._id });
		expect(await rightsOf(t, member)).toEqual({ canPlan: true, canManageAccess: false });
		await expect(tryToPlan(t, member)).resolves.toBeDefined();
		expect(
			await refusalMessageFrom(asUser(t, member).mutation(access.grant, { userId: other._id })),
		).toContain("Unauthorized");

		await asUser(t, leader).mutation(access.revoke, { grantId });
		expect(await rightsOf(t, member)).toEqual({ canPlan: false, canManageAccess: false });
	});

	it("refuses to give access to a non-internal, or to someone who already has it", async () => {
		const { t } = await setup();
		const leader = await internal(t, "leder@ifinavet.no", "Styret");
		const student = await insertUser(t, "student@uio.no");
		const member = await internal(t, "kari@ifinavet.no", "Bedrift");
		await asUser(t, leader).mutation(access.grant, { userId: member._id });

		expect(
			await refusalMessageFrom(asUser(t, leader).mutation(access.grant, { userId: student._id })),
		).toBe("Bare interne kan få tilgang til semesterplanen.");
		for (const user of [member, leader]) {
			expect(
				await refusalMessageFrom(asUser(t, leader).mutation(access.grant, { userId: user._id })),
			).toBe("Personen har allerede tilgang til semesterplanen.");
		}
	});

	it("removes the access when the member is removed as an internal", async () => {
		const { t } = await setup();
		const admin = await internal(t, "admin@ifinavet.no", "Styret", "admin");
		const member = await internal(t, "kari@ifinavet.no", "Bedrift");
		await asUser(t, admin).mutation(access.grant, { userId: member._id });
		const internalId = await t.run(
			async (ctx) =>
				(
					await ctx.db
						.query("internals")
						.withIndex("by_userId", (q) => q.eq("userId", member._id))
						.first()
				)?._id,
		);
		if (!internalId) throw new Error("Expected the internal to exist.");

		await asUser(t, admin).mutation(api.users.organization.mutations.removeInternal, {
			id: internalId,
		});

		expect(await asUser(t, admin).query(access.listGrants, {})).toEqual([]);
	});
});
