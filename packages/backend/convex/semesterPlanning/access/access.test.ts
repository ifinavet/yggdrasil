import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertInternal,
	insertUser,
	joinBoard,
	refusalMessageFrom,
	setup,
	type TestBackend,
	type TestUser,
} from "../../../test/fixtures";
import { api } from "../../_generated/api";
import type { AccessRole } from "../../auth/accessRights";

const access = api.semesterPlanning.access;
const createSemester = api.semesterPlanning.semesters.mutations.create;

async function boardMember(t: TestBackend, email = "leder@ifinavet.no") {
	const user = await insertUser(t, email);
	await joinBoard(t, user._id);
	return user;
}

async function internalIn(t: TestBackend, email: string, group: string, role: AccessRole) {
	const user = await insertUser(t, email);
	await grantRole(t, user._id, role);
	await insertInternal(t, user._id, "Intern", { group });
	return user;
}

async function rightsOf(t: TestBackend, user: TestUser) {
	return await asUser(t, user).query(access.queries.myRights, {});
}

async function tryToPlan(t: TestBackend, user: TestUser) {
	return await asUser(t, user).mutation(createSemester, { year: 2030, term: "spring" });
}

describe("who may plan the semester", () => {
	it("lets a board member plan and manage access, even with only the internal role", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);

		expect(await rightsOf(t, leader)).toEqual({ canPlan: true, canManageAccess: true });
		await expect(tryToPlan(t, leader)).resolves.toBeDefined();
	});

	it("refuses editors and admins outside the board", async () => {
		const { t } = await setup();
		const editor = await internalIn(t, "editor@ifinavet.no", "Arrangement", "editor");
		const admin = await internalIn(t, "admin@ifinavet.no", "Web", "admin");

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

	it("refuses a board row whose user no longer has an internal role", async () => {
		const { t } = await setup();
		const former = await insertUser(t, "tidligere@ifinavet.no");
		await insertInternal(t, former._id, "Leder");

		expect(await rightsOf(t, former)).toEqual({ canPlan: false, canManageAccess: false });
	});

	it("counts a login linked to a board member's account as the board member", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
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

	it("gives nothing to someone who is not signed in", async () => {
		const { t } = await setup();
		expect(await t.query(access.queries.myRights, {})).toEqual({
			canPlan: false,
			canManageAccess: false,
		});
	});
});

describe("grant and revoke", () => {
	it("lets the board give a member access to plan, but not to manage access", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");

		await asUser(t, leader).mutation(access.mutations.grant, { userId: member._id });

		expect(await rightsOf(t, member)).toEqual({ canPlan: true, canManageAccess: false });
		await expect(tryToPlan(t, member)).resolves.toBeDefined();
	});

	it("takes the access away again when the grant is revoked", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");
		const grantId = await asUser(t, leader).mutation(access.mutations.grant, {
			userId: member._id,
		});

		await asUser(t, leader).mutation(access.mutations.revoke, { grantId });

		expect(await rightsOf(t, member)).toEqual({ canPlan: false, canManageAccess: false });
		expect(await refusalMessageFrom(tryToPlan(t, member))).toContain("Unauthorized");
	});

	it("stops counting a grant once the member is no longer an active internal", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");
		await asUser(t, leader).mutation(access.mutations.grant, { userId: member._id });

		await t.run(async (ctx) => {
			const rights = await ctx.db
				.query("accessRights")
				.withIndex("by_userId", (q) => q.eq("userId", member._id))
				.collect();
			for (const row of rights) await ctx.db.delete(row._id);
		});

		expect(await rightsOf(t, member)).toEqual({ canPlan: false, canManageAccess: false });
		const { granted } = await asUser(t, leader).query(access.queries.list, {});
		expect(granted).toMatchObject([{ userId: member._id, active: false }]);
	});

	it("refuses a member given access who tries to give it on", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");
		const other = await internalIn(t, "ola@ifinavet.no", "Bedrift", "internal");
		const grantId = await asUser(t, leader).mutation(access.mutations.grant, {
			userId: member._id,
		});

		expect(
			await refusalMessageFrom(
				asUser(t, member).mutation(access.mutations.grant, { userId: other._id }),
			),
		).toContain("Unauthorized");
		expect(
			await refusalMessageFrom(asUser(t, member).mutation(access.mutations.revoke, { grantId })),
		).toContain("Unauthorized");
	});

	it("refuses an editor outside the board who tries to give access", async () => {
		const { t } = await setup();
		const editor = await internalIn(t, "editor@ifinavet.no", "Arrangement", "editor");
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");

		expect(
			await refusalMessageFrom(
				asUser(t, editor).mutation(access.mutations.grant, { userId: member._id }),
			),
		).toContain("Unauthorized");
	});

	it("refuses to give access to someone who is not an active internal", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const student = await insertUser(t, "student@uio.no");

		expect(
			await refusalMessageFrom(
				asUser(t, leader).mutation(access.mutations.grant, { userId: student._id }),
			),
		).toBe("Bare aktive interne kan få tilgang til semesterplanen.");
	});

	it("refuses to give access twice, or to a board member", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const otherLeader = await boardMember(t, "nestleder@ifinavet.no");
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");
		await asUser(t, leader).mutation(access.mutations.grant, { userId: member._id });

		for (const user of [member, otherLeader]) {
			expect(
				await refusalMessageFrom(
					asUser(t, leader).mutation(access.mutations.grant, { userId: user._id }),
				),
			).toBe("Personen har allerede tilgang til semesterplanen.");
		}
	});
});

describe("list", () => {
	it("shows the board, the grants and, to the board, who could be given access", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");
		const other = await internalIn(t, "ola@ifinavet.no", "Bedrift", "internal");
		await asUser(t, leader).mutation(access.mutations.grant, { userId: member._id });

		const list = await asUser(t, leader).query(access.queries.list, {});
		expect(list.canManageAccess).toBe(true);
		expect(list.board.map((row) => row.userId)).toEqual([leader._id]);
		expect(list.granted).toMatchObject([{ userId: member._id, active: true }]);
		expect(list.candidates.map((row) => row.userId)).toEqual([other._id]);
	});

	it("hides the candidates from a member given access", async () => {
		const { t } = await setup();
		const leader = await boardMember(t);
		const member = await internalIn(t, "kari@ifinavet.no", "Bedrift", "internal");
		await internalIn(t, "ola@ifinavet.no", "Bedrift", "internal");
		await asUser(t, leader).mutation(access.mutations.grant, { userId: member._id });

		const list = await asUser(t, member).query(access.queries.list, {});
		expect(list.canManageAccess).toBe(false);
		expect(list.candidates).toEqual([]);
	});

	it("refuses internals who may not plan", async () => {
		const { t } = await setup();
		const member = await internalIn(t, "ola@ifinavet.no", "Bedrift", "editor");

		expect(await refusalMessageFrom(asUser(t, member).query(access.queries.list, {}))).toContain(
			"Unauthorized",
		);
	});
});
