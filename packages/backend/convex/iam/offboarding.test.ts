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
	it("suspends Google and removes them from every Slack channel, even when they were added by hand", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });
		directories.slackChannels.set("U1", ["C1", "C2"]);

		await remove(internalId);

		expect(directories.google.get("per.hansen@ifinavet.no")?.suspended).toBe(true);
		expect(directories.slackChannels.get("U1")).toEqual([]);
		const account = await accountOf(user._id);
		expect(account).toMatchObject({
			stage: "offboarded",
			google: "suspended",
			slackUserId: "U1",
			slackChannelsRemoved: 2,
		});
		expect(account?.lastError).toBeUndefined();
	});

	it("finds the Slack user through the UiO address and skips Google for addresses outside the domain", async () => {
		const { user, internalId } = await internalMember("perh@uio.no");
		directories.slackUsers.push({ id: "U2", email: "perh@uio.no", name: "Per Hansen" });
		directories.slackChannels.set("U2", ["C1"]);

		await remove(internalId);

		expect(await accountOf(user._id)).toMatchObject({
			stage: "offboarded",
			google: "not_applicable",
			slackChannelsRemoved: 1,
		});
		expect(directories.calls.some((call) => call.url.includes("admin.googleapis.com"))).toBe(false);
	});

	it("keeps the member in the removal list with an explanation until Slack is connected", async () => {
		vi.stubEnv("SLACK_BOT_TOKEN", "");
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });

		await remove(internalId);
		const account = await accountOf(user._id);
		expect(account).toMatchObject({
			stage: "offboarding",
			google: "suspended",
			lastError: "Slack er ikke koblet til ennå.",
		});

		configureSlack();
		await asUser(t, admin).mutation(api.iam.mutations.retry, {
			accountId: account?._id as Id<"memberAccounts">,
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect((await accountOf(user._id))?.stage).toBe("offboarded");
	});

	it("leaves #general alone without treating it as a failure", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });
		directories.slackChannels.set("U1", ["CGENERAL", "C1"]);
		directories.generalChannels.add("CGENERAL");

		await remove(internalId);

		const account = await accountOf(user._id);
		expect(account).toMatchObject({ stage: "offboarded", slackChannelsRemoved: 1 });
		expect(account?.lastError).toBeUndefined();
	});

	it("keeps going past a channel it cannot leave and finishes it on retry", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.google.set("per.hansen@ifinavet.no", { name: "Per Hansen", suspended: false });
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });
		directories.slackChannels.set("U1", ["C1", "C2", "C3"]);
		directories.restrictedChannels.add("C2");

		await remove(internalId);

		const account = await accountOf(user._id);
		expect(directories.slackChannels.get("U1")).toEqual(["C2"]);
		expect(account).toMatchObject({
			stage: "offboarding",
			google: "suspended",
			slackChannelsRemoved: 2,
			lastError:
				"Fikk ikke fjernet personen fra 1 Slack-kanal. Legg til Navet-appen i kanalene og prøv igjen.",
		});

		directories.restrictedChannels.clear();
		await asUser(t, admin).mutation(api.iam.mutations.retry, {
			accountId: account?._id as Id<"memberAccounts">,
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const retried = await accountOf(user._id);
		expect(retried).toMatchObject({ stage: "offboarded", slackChannelsRemoved: 3 });
		expect(retried?.lastError).toBeUndefined();
	});

	it("records Google failures without losing the Slack cleanup", async () => {
		const { user, internalId } = await internalMember("per.hansen@ifinavet.no");
		directories.failures.google = true;
		directories.slackUsers.push({ id: "U1", email: "per.hansen@ifinavet.no", name: "Per Hansen" });
		directories.slackChannels.set("U1", ["C1"]);

		await remove(internalId);

		expect(await accountOf(user._id)).toMatchObject({
			stage: "offboarding",
			google: "pending",
			slackChannelsRemoved: 1,
			lastError: "Google svarte 503 da vi skulle oppdatere kontoen.",
		});
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
