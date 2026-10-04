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
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

let t: TestBackend;
let admin: TestUser;
let directories: ReturnType<typeof fakeDirectories>;

beforeEach(async () => {
	vi.useFakeTimers();
	({ t } = await setup());
	admin = await insertUser(t, "leder@ifinavet.no");
	await grantRole(t, admin._id, "admin");
	await configureGoogle();
	configureSlack();
	directories = fakeDirectories();
	spyOnWelcomeEmails();
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

async function remove(internalId: Id<"internals">) {
	await asUser(t, admin).mutation(api.users.organization.mutations.removeInternal, {
		id: internalId,
	});
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

describe("removing an internal member", () => {
	it("suspends Google and remembers the Slack account for the deactivation checklist", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });

		await remove(internalId);

		expect(directories.google.get("per.hansen@ifinavet.no")?.suspended).toBe(true);
		const account = await accountOf(user._id);
		expect(account).toMatchObject({
			stage: "offboarded",
			google: "suspended",
			slackUserId: "U1",
		});
		expect(account?.lastError).toBeUndefined();
	});

	it("never looks up Slack or Google for an address outside the domain", async () => {
		const { user, internalId } = await internalMember("perh@uio.no");
		directories.slackUsers.push({ id: "U2", email: "perh@uio.no", name: "Per Hansen" });

		await remove(internalId);

		const account = await accountOf(user._id);
		expect(account).toMatchObject({ stage: "offboarded", google: "not_applicable" });
		expect(account?.slackUserId).toBeUndefined();
		expect(directories.calls.some((call) => call.url.includes("admin.googleapis.com"))).toBe(false);
	});

	it("finishes the removal without Slack and flags the Slack account once Slack is connected", async () => {
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });

		await remove(internalId);
		const account = await accountOf(user._id);
		expect(account).toMatchObject({ stage: "offboarded", google: "suspended" });
		expect(account?.lastError).toBeUndefined();

		configureSlack();
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });
		await t.action(internal.iam.actions.reconcile, {});

		const drift = await t.run((ctx) => ctx.db.query("accessDrift").collect());
		expect(drift).toMatchObject([
			{ kind: "slack_without_member", email: "per.hansen@ifinavet.no" },
		]);
	});

	it("records Google failures and still finds the Slack account", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.failures.google = true;
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });

		await remove(internalId);

		expect(await accountOf(user._id)).toMatchObject({
			stage: "offboarding",
			google: "pending",
			slackUserId: "U1",
			lastError: "Google svarte 503 da vi skulle oppdatere kontoen. down",
		});
	});

	it("keeps the removal state when a welcome email finishes after the member was removed", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.failures.google = true;
		await remove(internalId);
		const before = await accountOf(user._id);
		if (!before) throw new Error("missing account");

		await t.mutation(internal.iam.internal.recordProvisioned, {
			accountId: before._id,
			google: "created",
			welcomeSent: true,
		});

		expect(await accountOf(user._id)).toEqual(before);
	});
});

describe("the Slack deactivation checklist", () => {
	it("stays in the overview until someone marks Slack as deactivated", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });
		await remove(internalId);
		const client = asUser(t, admin);

		const before = await client.query(api.iam.queries.overview, {});
		expect(before.accounts.map((account) => account.workspaceEmail)).toEqual([
			"per.hansen@ifinavet.no",
		]);

		const account = await accountOf(user._id);
		await client.mutation(api.iam.mutations.markSlackDeactivated, {
			accountId: account?._id as Id<"memberAccounts">,
		});

		const after = await client.query(api.iam.queries.overview, {});
		expect(after.accounts).toEqual([]);
	});

	it("refuses to mark members who are not being removed", async () => {
		const accountId = await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "ny@ifinavet.no",
				firstName: "Ny",
				lastName: "Person",
				group: "Bedrift",
				stage: "active",
				google: "created",
				updatedAt: 0,
			}),
		);

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.markSlackDeactivated, { accountId }),
			),
		).toBe("Personen er ikke under fjerning.");
	});
});

describe("the access overview", () => {
	it("is only for admins", async () => {
		const member = await insertUser(t, "intern@ifinavet.no");
		await grantRole(t, member._id, "internal");

		await expect(asUser(t, member).query(api.iam.queries.overview, {})).rejects.toThrow();
	});

	it("tells which integrations are connected", async () => {
		vi.stubEnv("SLACK_BOT_TOKEN", "");

		expect(await asUser(t, admin).query(api.iam.queries.overview, {})).toMatchObject({
			domain: "ifinavet.no",
			google: true,
			slack: false,
			slackInvite: true,
		});
	});
});
