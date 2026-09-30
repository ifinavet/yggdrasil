import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertUser,
	refusalMessageFrom,
	setup,
	type TestBackend,
	type TestUser,
} from "../../test/fixtures";
import {
	configureGoogle,
	configureSlack,
	fakeDirectories,
	spyOnWelcomeEmails,
} from "../../test/iamFakes";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

let t: TestBackend;
let admin: TestUser;
let directories: ReturnType<typeof fakeDirectories>;
let emails: ReturnType<typeof spyOnWelcomeEmails>;

beforeEach(async () => {
	vi.useFakeTimers();
	({ t } = await setup());
	admin = await insertUser(t, "leder@ifinavet.no");
	await grantRole(t, admin._id, "admin");
	await configureGoogle();
	configureSlack();
	directories = fakeDirectories();
	emails = spyOnWelcomeEmails();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

async function internalMember(email: string) {
	const user = await insertUser(t, email, { firstName: "Per", lastName: "Hansen" });
	const internalId = await t.run(async (ctx) => {
		await ctx.db.insert("accessRights", { userId: user._id, role: "internal" });
		return ctx.db.insert("internals", { userId: user._id, group: "Bedrift", position: "Intern" });
	});
	return { user, internalId };
}

async function addUioEmail(internalId: Id<"internals">, uioEmail: string) {
	await asUser(t, admin).mutation(api.iam.mutations.addUioEmail, { internalId, uioEmail });
	await t.finishAllScheduledFunctions(vi.runAllTimers);
}

function accountOf(userId: Id<"users">) {
	return t.run((ctx) =>
		ctx.db
			.query("memberAccounts")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.first(),
	);
}

function formerAccount(fields: { workspaceEmail: string }) {
	return t.run((ctx) =>
		ctx.db.insert("memberAccounts", {
			...fields,
			uioEmail: "perha@uio.no",
			firstName: "Per",
			lastName: "Hansen",
			group: "Webgruppen",
			stage: "offboarded",
			google: "suspended",
			googleUserId: "G-OLD",
			slackUserId: "U-OLD",
			updatedAt: 0,
		}),
	);
}

function hasInternalAccess(user: TestUser) {
	return asUser(t, user).query(api.auth.accessRights.checkRights, { right: ["internal"] });
}

describe("adding a UiO address to an existing internal member", () => {
	it("links the address to their ifinavet user without touching Google", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });

		await addUioEmail(internalId, " PerHa@UiO.no ");

		expect(await accountOf(user._id)).toMatchObject({
			workspaceEmail: "per.hansen@ifinavet.no",
			uioEmail: "perha@uio.no",
			stage: "active",
			google: "existing",
			group: "Bedrift",
			slackUserId: "U1",
		});
		expect(directories.calls.filter((call) => call.url.includes("googleapis.com"))).toEqual([]);
		expect(emails).not.toHaveBeenCalled();
	});

	it("does not link a Slack member who only has the UiO address", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.slackUsers.push({ id: "U9", email: "perha@uio.no", name: "Per Hansen" });

		await addUioEmail(internalId, "perha@uio.no");

		expect((await accountOf(user._id))?.slackUserId).toBeUndefined();
	});

	it("gives their UiO login the same access, and removing the member takes it from both", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		const uioLogin = await insertUser(t, "perha@uio.no");

		await addUioEmail(internalId, "perha@uio.no");

		expect(await hasInternalAccess(uioLogin)).toBe(true);

		await asUser(t, admin).mutation(api.users.organization.mutations.removeInternal, {
			id: internalId,
		});

		expect(await hasInternalAccess(user)).toBe(false);
		expect(await hasInternalAccess(uioLogin)).toBe(false);
	});

	it("updates the address on an account Bifrost already made", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		await addUioEmail(internalId, "perha@uio.no");

		await addUioEmail(internalId, "perhan@uio.no");

		const accounts = await t.run((ctx) => ctx.db.query("memberAccounts").collect());
		expect(accounts).toHaveLength(1);
		expect(await accountOf(user._id)).toMatchObject({ uioEmail: "perhan@uio.no" });
	});

	it("marks Google as not applicable for members whose address is outside the domain", async () => {
		const { user, internalId } = await internalMember("per@gmail.com");

		await addUioEmail(internalId, "perha@uio.no");

		expect(await accountOf(user._id)).toMatchObject({ google: "not_applicable" });
	});

	it("leaves a former account with the same UiO address intact and gives the member their own", async () => {
		const formerId = await formerAccount({ workspaceEmail: "gammel@ifinavet.no" });
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");

		await addUioEmail(internalId, "perha@uio.no");

		expect(await accountOf(user._id)).toMatchObject({
			workspaceEmail: "per.hansen@ifinavet.no",
			uioEmail: "perha@uio.no",
			stage: "active",
		});
		const former = await t.run((ctx) => ctx.db.get(formerId));
		expect(former).toMatchObject({
			workspaceEmail: "gammel@ifinavet.no",
			stage: "offboarded",
			google: "suspended",
			googleUserId: "G-OLD",
			slackUserId: "U-OLD",
		});
		expect(former?.uioEmail).toBeUndefined();
	});

	it("moves the address from a former account to a member who already has an account", async () => {
		const formerId = await formerAccount({ workspaceEmail: "gammel@ifinavet.no" });
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		await addUioEmail(internalId, "perhan@uio.no");

		await addUioEmail(internalId, "perha@uio.no");

		expect(await accountOf(user._id)).toMatchObject({ uioEmail: "perha@uio.no", stage: "active" });
		expect((await t.run((ctx) => ctx.db.get(formerId)))?.uioEmail).toBeUndefined();
	});

	it("reopens the member's own former account and keeps its Google and Slack ids", async () => {
		const formerId = await formerAccount({ workspaceEmail: "per.hansen@ifinavet.no" });
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");

		await addUioEmail(internalId, "perha@uio.no");

		expect(await accountOf(user._id)).toMatchObject({
			_id: formerId,
			stage: "active",
			googleUserId: "G-OLD",
			slackUserId: "U-OLD",
		});
	});

	it("refuses an address that is not a UiO address", async () => {
		const { internalId } = await internalMember("per.hansen@ifinavet.no");

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.addUioEmail, {
					internalId,
					uioEmail: "per@gmail.com",
				}),
			),
		).toBe("Bruk UiO-adressen, den som slutter på uio.no.");
	});

	it("refuses an address that belongs to another member", async () => {
		const { internalId } = await internalMember("per.hansen@ifinavet.no");
		const other = await internalMember("kari@ifinavet.no");
		await addUioEmail(other.internalId, "perha@uio.no");

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.addUioEmail, {
					internalId,
					uioEmail: "perha@uio.no",
				}),
			),
		).toBe("perha@uio.no hører allerede til Per Hansen.");
	});

	it("refuses when the UiO login is already a separate internal member", async () => {
		const { internalId } = await internalMember("per.hansen@ifinavet.no");
		await internalMember("perha@uio.no");

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.addUioEmail, {
					internalId,
					uioEmail: "perha@uio.no",
				}),
			),
		).toBe("perha@uio.no er allerede internt medlem.");
	});

	it("refuses to make the linked UiO login a separate internal member", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		await t.run(async (ctx) => {
			const right = await ctx.db
				.query("accessRights")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.first();
			if (right) await ctx.db.patch(right._id, { role: "admin" });
		});
		const uioLogin = await insertUser(t, "perha@uio.no");
		await addUioEmail(internalId, "perha@uio.no");

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.users.organization.mutations.createInternal, {
					userId: uioLogin._id,
					group: "Bedrift",
				}),
			),
		).toBe("perha@uio.no er allerede internt medlem.");
		expect(
			await asUser(t, uioLogin).query(api.auth.accessRights.checkRights, { right: ["admin"] }),
		).toBe(true);
	});

	it("never passes super-admin on to a linked login", async () => {
		const superAdmin = await insertUser(t, "sjef@uio.no");
		await grantRole(t, superAdmin._id, "super-admin");

		await asUser(t, superAdmin).mutation(api.iam.mutations.startOnboarding, {
			firstName: "Sjef",
			lastName: "Sjefesen",
			workspaceEmail: "sjef@ifinavet.no",
			uioEmail: "sjef@uio.no",
			group: "Styret",
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const workspaceLogin = await insertUser(t, "sjef@ifinavet.no");
		const rights = (right: "super-admin" | "admin") =>
			asUser(t, workspaceLogin).query(api.auth.accessRights.checkRights, { right: [right] });

		expect(await rights("super-admin")).toBe(false);
		expect(await rights("admin")).toBe(true);
	});

	it("refuses members without an admin role", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");

		await expect(
			asUser(t, user).mutation(api.iam.mutations.addUioEmail, {
				internalId,
				uioEmail: "perha@uio.no",
			}),
		).rejects.toThrow();
	});
});

describe("searching for UiO users", () => {
	function search(query: string, user: TestUser = admin) {
		return asUser(t, user).query(api.iam.queries.searchUioUsers, { query });
	}

	it("finds UiO users by name or address and leaves out everyone else", async () => {
		const per = await insertUser(t, "perha@uio.no", { firstName: "Per", lastName: "Hansen" });
		await insertUser(t, "per.hansen@ifinavet.no", { firstName: "Per", lastName: "Hansen" });
		await insertUser(t, "kari@uio.no", { firstName: "Kari", lastName: "Nordmann" });
		const hit = { userId: per._id, email: "perha@uio.no", firstName: "Per", lastName: "Hansen" };

		expect(await search("per hansen")).toEqual([hit]);
		expect(await search("Hansen")).toEqual([hit]);
		expect(await search("perha@uio.no")).toEqual([hit]);
		expect(await search("per nordmann")).toEqual([]);
	});

	it("returns nothing for a blank query", async () => {
		await insertUser(t, "perha@uio.no", { firstName: "Per", lastName: "Hansen" });

		expect(await search("   ")).toEqual([]);
	});

	it("refuses members without an admin role", async () => {
		const { user } = await internalMember("per.hansen@ifinavet.no");

		await expect(search("per", user)).rejects.toThrow();
	});
});
