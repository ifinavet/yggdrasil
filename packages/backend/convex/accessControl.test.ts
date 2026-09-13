/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import {
	asUser,
	grantRole,
	insertInternal,
	insertUser,
	refusalMessageFrom,
	roleOf,
	setup,
} from "../test/fixtures";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function companyArgs(logoId: Id<"companyLogos">) {
	return { orgNumber: 987654321, name: "Ny bedrift", description: "", logo: logoId };
}

async function companyCount(t: Awaited<ReturnType<typeof setup>>["t"]) {
	return t.run(async (ctx) => (await ctx.db.query("companies").collect()).length);
}

describe("role chokepoint on companies.create", () => {
	it("refuses a student without a role and names the required roles", async () => {
		const { t, logoId } = await setup();
		const student = await insertUser(t, "student@example.com");

		const message = await refusalMessageFrom(
			asUser(t, student).mutation(api.companies.mutations.create, companyArgs(logoId)),
		);

		expect(message).toContain("super-admin");
		expect(message).toContain("admin");
	});

	it("lets an admin create a company", async () => {
		const { t, logoId } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");

		await asUser(t, admin).mutation(api.companies.mutations.create, companyArgs(logoId));

		expect(await companyCount(t)).toBe(2);
	});
});

describe("upsertAccessRights", () => {
	it("refuses an admin who is not a super-admin", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const target = await insertUser(t, "target@example.com");

		const message = await refusalMessageFrom(
			asUser(t, admin).mutation(api.auth.accessRights.upsertAccessRights, {
				userId: target._id,
				role: "editor",
			}),
		);

		expect(message).toContain("super-admin");
		expect(await roleOf(t, target._id)).toBeNull();
	});

	it("refuses the only super-admin demoting themselves", async () => {
		const { t } = await setup();
		const superAdmin = await insertUser(t, "super@example.com");
		await grantRole(t, superAdmin._id, "super-admin");

		const message = await refusalMessageFrom(
			asUser(t, superAdmin).mutation(api.auth.accessRights.upsertAccessRights, {
				userId: superAdmin._id,
				role: "admin",
			}),
		);

		expect(message).toContain("siste super-administratoren");
		expect(await roleOf(t, superAdmin._id)).toBe("super-admin");
	});

	it("lets one of two super-admins demote the other", async () => {
		const { t } = await setup();
		const caller = await insertUser(t, "super-one@example.com");
		await grantRole(t, caller._id, "super-admin");
		const colleague = await insertUser(t, "super-two@example.com");
		await grantRole(t, colleague._id, "super-admin");

		await asUser(t, caller).mutation(api.auth.accessRights.upsertAccessRights, {
			userId: colleague._id,
			role: "admin",
		});

		expect(await roleOf(t, colleague._id)).toBe("admin");
	});
});

describe("removeInternal", () => {
	it("refuses an admin removing a super-admin", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const superAdmin = await insertUser(t, "super@example.com");
		await grantRole(t, superAdmin._id, "super-admin");
		const superAdminInternalId = await insertInternal(t, superAdmin._id, "Leder");

		const message = await refusalMessageFrom(
			asUser(t, admin).mutation(api.users.organization.mutations.removeInternal, {
				id: superAdminInternalId,
			}),
		);

		expect(message).toContain("super-admin");
		expect(await roleOf(t, superAdmin._id)).toBe("super-admin");
	});

	it("lets a super-admin remove an internal and revokes their access rights", async () => {
		const { t } = await setup();
		const superAdmin = await insertUser(t, "super@example.com");
		await grantRole(t, superAdmin._id, "super-admin");
		const member = await insertUser(t, "internal@example.com");
		await grantRole(t, member._id, "internal");
		const memberInternalId = await insertInternal(t, member._id);

		await asUser(t, superAdmin).mutation(api.users.organization.mutations.removeInternal, {
			id: memberInternalId,
		});

		expect(await roleOf(t, member._id)).toBeNull();
		expect(await t.run((ctx) => ctx.db.get(memberInternalId))).toBeNull();
	});
});

describe("createInternal", () => {
	it("keeps an existing editor role", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const editor = await insertUser(t, "editor@example.com");
		await grantRole(t, editor._id, "editor");

		await asUser(t, admin).mutation(api.users.organization.mutations.createInternal, {
			userId: editor._id,
			group: "Testgruppe",
		});

		expect(await roleOf(t, editor._id)).toBe("editor");
	});

	it("assigns the internal role to a user without one", async () => {
		const { t } = await setup();
		const admin = await insertUser(t, "admin@example.com");
		await grantRole(t, admin._id, "admin");
		const newcomer = await insertUser(t, "newcomer@example.com");

		await asUser(t, admin).mutation(api.users.organization.mutations.createInternal, {
			userId: newcomer._id,
			group: "Testgruppe",
		});

		expect(await roleOf(t, newcomer._id)).toBe("internal");
	});
});

describe("upsertBoardMember", () => {
	it("keeps the caller's role when they hand over their own seat", async () => {
		const { t } = await setup();
		const caller = await insertUser(t, "super@example.com");
		await grantRole(t, caller._id, "super-admin");
		const callerSeatId = await insertInternal(t, caller._id, "Leder");
		const successor = await insertUser(t, "successor@example.com");
		await insertInternal(t, successor._id);

		await asUser(t, caller).mutation(api.users.organization.mutations.upsertBoardMember, {
			id: callerSeatId,
			userId: successor._id,
			position: "Leder",
			group: "Styret",
			role: "admin",
		});

		expect(await roleOf(t, caller._id)).toBe("super-admin");
		expect(await roleOf(t, successor._id)).toBe("admin");
	});
});
