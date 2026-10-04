import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertUser,
	setup,
	type TestBackend,
	type TestUser,
} from "../../test/fixtures";
import { ADMIN_EMAIL, configureGoogle, configureSlack, fakeDirectories } from "../../test/iamFakes";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { matchSlack } from "./actions";
import { computeDrift } from "./drift";

const directory = {
	memberEmails: new Set(["kari@ifinavet.no"]),
	internalWorkspaceEmails: new Set(["kari@ifinavet.no"]),
	reservedEmails: new Set(["styret@ifinavet.no"]),
};

describe("computeDrift", () => {
	it("flags accounts nobody added and members who lost their Google account", () => {
		const drift = computeDrift(
			{ ...directory, internalWorkspaceEmails: new Set(["kari@ifinavet.no", "ola@ifinavet.no"]) },
			[
				{ email: "kari@ifinavet.no", name: "Kari", suspended: false },
				{ email: "ola@ifinavet.no", name: "Ola", suspended: true },
				{ email: "ukjent@ifinavet.no", name: "Ukjent", suspended: false },
				{ email: "gammel@ifinavet.no", name: "Gammel", suspended: true },
				{ email: "styret@ifinavet.no", name: "Styret", suspended: false },
			],
			[
				{ id: "U1", email: "kari@ifinavet.no", name: "Kari", deactivated: false },
				{ id: "U2", email: "gjest@gmail.com", name: "Gjest", deactivated: false },
				{ id: "U3", email: "borte@gmail.com", name: "Borte", deactivated: true },
			],
		);

		expect(drift).toEqual([
			{ kind: "google_without_member", email: "ukjent@ifinavet.no", name: "Ukjent" },
			{ kind: "member_google_suspended", email: "ola@ifinavet.no" },
			{ kind: "slack_without_member", email: "gjest@gmail.com", name: "Gjest" },
		]);
	});

	it("reports nothing for a directory it could not read", () => {
		expect(computeDrift(directory, null, null)).toEqual([]);
	});
});

describe("matchSlack", () => {
	const accountId = "account" as Id<"memberAccounts">;

	it("links members by email and notices deactivated Slack users of removed members", () => {
		expect(
			matchSlack(
				[
					{ accountId, stage: "active", email: "Kari@ifinavet.no" },
					{ accountId, stage: "offboarded", email: "per@ifinavet.no", slackUserId: "U2" },
				],
				[
					{ id: "U1", email: "kari@ifinavet.no", name: "Kari", deactivated: false },
					{ id: "U2", email: "per@ifinavet.no", name: "Per", deactivated: true },
				],
			),
		).toEqual({
			slackLinks: [{ accountId, slackUserId: "U1" }],
			slackDeactivated: [accountId],
			slackStillActive: [],
		});
	});

	it("does nothing without Slack data", () => {
		expect(matchSlack([{ accountId, stage: "active", email: "kari@ifinavet.no" }], null)).toEqual({
			slackLinks: [],
			slackDeactivated: [],
			slackStillActive: [],
		});
	});
});

describe("nightly reconciliation", () => {
	let t: TestBackend;
	let admin: TestUser;
	let directories: ReturnType<typeof fakeDirectories>;

	beforeEach(async () => {
		({ t } = await setup());
		admin = await insertUser(t, "leder@ifinavet.no");
		await grantRole(t, admin._id, "admin");
		await t.run((ctx) =>
			ctx.db.insert("internals", { userId: admin._id, group: "Styret", position: "Leder" }),
		);
		await configureGoogle();
		configureSlack();
		directories = fakeDirectories();
		directories.google.set(ADMIN_EMAIL, { name: "Admin", suspended: false });
		directories.google.set("leder@ifinavet.no", { name: "Leder", suspended: false });
		directories.google.set("snik@ifinavet.no", { name: "Snik", suspended: false });
		directories.slackUsers.push(
			{ id: "U1", email: "leder@ifinavet.no", name: "Leder" },
			{ id: "U9", email: "gjest@gmail.com", name: "Gjest" },
			{ id: "B1", email: "bot@ifinavet.no", name: "Bot", bot: true },
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("exposes a shared Google failure and clears it after a successful check", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json(
						{ error: "invalid_client", error_description: "Client rejected" },
						{ status: 401 },
					),
				),
		);
		await t.action(internal.iam.actions.reconcile, {});
		expect(
			(await asUser(t, admin).query(api.iam.queries.overview, {})).googleConnectionError,
		).toContain("invalid_client: Client rejected");
		fakeDirectories();
		await t.action(internal.iam.actions.reconcile, {});
		expect(
			(await asUser(t, admin).query(api.iam.queries.overview, {})).googleConnectionError,
		).toBeUndefined();
	});

	it("keeps a newer connection result when an older check finishes late", async () => {
		await t.mutation(internal.iam.internal.recordGoogleConnection, { startedAt: 200 });
		await t.mutation(internal.iam.internal.recordGoogleConnection, {
			startedAt: 100,
			message: "Old failure",
		});
		expect(
			(await asUser(t, admin).query(api.iam.queries.overview, {})).googleConnectionError,
		).toBeUndefined();
	});

	it("moves saved OAuth errors into the banner without losing account-specific errors", async () => {
		await t.run(async (ctx) => {
			for (const [email, message] of [
				["oauth@example.test", "Google avviste innloggingen (401)."],
				["other@example.test", "Resend er nede."],
			]) {
				await ctx.db.insert("memberAccounts", {
					workspaceEmail: email,
					firstName: "Test",
					lastName: "User",
					group: "Web",
					stage: "onboarding",
					google: "pending",
					lastError: message,
					updatedAt: 1,
				});
			}
		});
		const overview = await asUser(t, admin).query(api.iam.queries.overview, {});
		expect(overview.googleConnectionError).toBe("Google avviste innloggingen (401).");
		expect(
			overview.accounts.find((account) => account.workspaceEmail === "oauth@example.test"),
		).toMatchObject({ googleConnectionBlocked: true });
		expect(
			overview.accounts.find((account) => account.workspaceEmail === "oauth@example.test")
				?.lastError,
		).toBeUndefined();
		expect(
			overview.accounts.find((account) => account.workspaceEmail === "other@example.test")
				?.lastError,
		).toBe("Resend er nede.");
	});

	async function drift() {
		return (await asUser(t, admin).query(api.iam.queries.overview, {})).drift.map(
			({ kind, email }) => ({
				kind,
				email,
			}),
		);
	}

	it("creates a member account for every internal and links Google and Slack by their address", async () => {
		await t.action(internal.iam.actions.reconcile, {});

		const account = await t.run((ctx) =>
			ctx.db
				.query("memberAccounts")
				.withIndex("by_userId", (q) => q.eq("userId", admin._id))
				.first(),
		);
		expect(account).toMatchObject({
			workspaceEmail: "leder@ifinavet.no",
			stage: "active",
			google: "existing",
			googleUserId: "google-leder@ifinavet.no",
			slackUserId: "U1",
		});
		expect(account?.uioEmail).toBeUndefined();

		await t.action(internal.iam.actions.reconcile, {});
		const accounts = await t.run((ctx) => ctx.db.query("memberAccounts").collect());
		expect(accounts).toHaveLength(1);
	});

	it("marks internals outside the workspace domain as not needing Google", async () => {
		const guest = await insertUser(t, "ekstern@gmail.com");
		await t.run((ctx) =>
			ctx.db.insert("internals", { userId: guest._id, group: "Styret", position: "Ekstern" }),
		);

		await t.action(internal.iam.actions.reconcile, {});

		const accounts = await t.run((ctx) => ctx.db.query("memberAccounts").collect());
		expect(accounts.find((account) => account.userId === guest._id)).toMatchObject({
			workspaceEmail: "ekstern@gmail.com",
			google: "not_applicable",
		});
	});

	it("lets an admin run the check right away", async () => {
		vi.useFakeTimers();
		await asUser(t, admin).mutation(api.iam.mutations.checkNow, {});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		vi.useRealTimers();

		const accounts = await t.run((ctx) => ctx.db.query("memberAccounts").collect());
		expect(accounts).toMatchObject([{ workspaceEmail: "leder@ifinavet.no", slackUserId: "U1" }]);
	});

	it("refuses the check for members without admin rights", async () => {
		const member = await insertUser(t, "medlem@ifinavet.no");
		await expect(asUser(t, member).mutation(api.iam.mutations.checkNow, {})).rejects.toThrow();
	});

	it("lists accounts created outside Bifrost and forgets the ones an admin ignores", async () => {
		await t.action(internal.iam.actions.reconcile, {});

		expect(await drift()).toEqual(
			expect.arrayContaining([
				{ kind: "google_without_member", email: "snik@ifinavet.no" },
				{ kind: "slack_without_member", email: "gjest@gmail.com" },
			]),
		);
		expect(await drift()).toHaveLength(2);

		await asUser(t, admin).mutation(api.iam.mutations.ignoreDrift, { email: "snik@ifinavet.no" });
		await t.action(internal.iam.actions.reconcile, {});

		expect(await drift()).toEqual([{ kind: "slack_without_member", email: "gjest@gmail.com" }]);
	});

	it("ignores an address however an admin happens to write it", async () => {
		await t.action(internal.iam.actions.reconcile, {});

		await asUser(t, admin).mutation(api.iam.mutations.ignoreDrift, { email: " Snik@IFINAVET.no " });
		await t.action(internal.iam.actions.reconcile, {});

		expect(await drift()).toEqual([{ kind: "slack_without_member", email: "gjest@gmail.com" }]);
	});

	it("learns the Google id of existing accounts and follows a rename made in Google", async () => {
		const accountId = await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "leder@ifinavet.no",
				firstName: "Leder",
				lastName: "Nordmann",
				group: "Styret",
				stage: "active",
				google: "existing",
				userId: admin._id,
				updatedAt: 0,
			}),
		);

		await t.action(internal.iam.actions.reconcile, {});
		expect(await t.run((ctx) => ctx.db.get(accountId))).toMatchObject({
			googleUserId: "google-leder@ifinavet.no",
		});

		directories.renameGoogle("leder@ifinavet.no", "leder.ny@ifinavet.no");
		await t.action(internal.iam.actions.reconcile, {});

		expect(await t.run((ctx) => ctx.db.get(accountId))).toMatchObject({
			googleUserId: "google-leder@ifinavet.no",
			workspaceEmail: "leder.ny@ifinavet.no",
		});
		expect(await drift()).not.toContainEqual(
			expect.objectContaining({ email: "leder.ny@ifinavet.no" }),
		);
	});

	it("leaves members alone while their removal is still running", async () => {
		directories.google.set("borte@ifinavet.no", { name: "Borte", suspended: false });
		await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "borte@ifinavet.no",
				uioEmail: "borte@uio.no",
				firstName: "Borte",
				lastName: "Nordmann",
				group: "Bedrift",
				stage: "offboarding",
				google: "created",
				updatedAt: 0,
			}),
		);

		await t.action(internal.iam.actions.reconcile, {});

		expect(await drift()).not.toContainEqual(
			expect.objectContaining({ email: "borte@ifinavet.no" }),
		);
	});

	it("keeps the last Google findings when Google cannot be read", async () => {
		await t.action(internal.iam.actions.reconcile, {});
		directories.failures.google = true;
		directories.slackUsers.splice(1, 1);

		await t.action(internal.iam.actions.reconcile, {});

		expect(await drift()).toEqual([{ kind: "google_without_member", email: "snik@ifinavet.no" }]);
	});

	it("stops listing an address as unknown once it is being added as a member", async () => {
		await t.action(internal.iam.actions.reconcile, {});
		await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "snik@ifinavet.no",
				firstName: "Snik",
				lastName: "Snikesen",
				group: "Styret",
				stage: "onboarding",
				google: "pending",
				updatedAt: Date.now(),
			}),
		);

		expect(await drift()).toEqual([{ kind: "slack_without_member", email: "gjest@gmail.com" }]);
	});

	it("marks Slack as deactivated for removed members once Slack reports it", async () => {
		const accountId = await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "per@ifinavet.no",
				firstName: "Per",
				lastName: "Hansen",
				group: "Bedrift",
				stage: "offboarded",
				google: "suspended",
				slackUserId: "U5",
				updatedAt: 0,
			}),
		);
		directories.slackUsers.push({ id: "U5", email: "per@ifinavet.no", name: "Per", deleted: true });

		await t.action(internal.iam.actions.reconcile, {});

		expect((await t.run((ctx) => ctx.db.get(accountId)))?.slackDeactivatedAt).toEqual(
			expect.any(Number),
		);
	});

	it("links Slack members only through ifinavet addresses", async () => {
		const account = (workspaceEmail: string) =>
			t.run((ctx) =>
				ctx.db.insert("memberAccounts", {
					workspaceEmail,
					firstName: "Kari",
					lastName: "Nordmann",
					group: "Bedrift",
					stage: "active",
					google: "not_applicable",
					updatedAt: 0,
				}),
			);
		const outside = await account("karinor@uio.no");
		const inside = await account("kari@ifinavet.no");
		directories.slackUsers.push(
			{ id: "U6", email: "karinor@uio.no", name: "Kari" },
			{ id: "U7", email: "kari@ifinavet.no", name: "Kari" },
		);

		await t.action(internal.iam.actions.reconcile, {});

		expect((await t.run((ctx) => ctx.db.get(outside)))?.slackUserId).toBeUndefined();
		expect((await t.run((ctx) => ctx.db.get(inside)))?.slackUserId).toBe("U7");
	});

	it("brings the Slack reminder back when someone marked it done but the account is still active", async () => {
		const accountId = await t.run((ctx) =>
			ctx.db.insert("memberAccounts", {
				workspaceEmail: "per@ifinavet.no",
				firstName: "Per",
				lastName: "Hansen",
				group: "Bedrift",
				stage: "offboarded",
				google: "suspended",
				slackUserId: "U5",
				slackDeactivatedAt: 1,
				updatedAt: 0,
			}),
		);
		directories.slackUsers.push({ id: "U5", email: "per@ifinavet.no", name: "Per" });

		await t.action(internal.iam.actions.reconcile, {});

		expect((await t.run((ctx) => ctx.db.get(accountId)))?.slackDeactivatedAt).toBeUndefined();
		const overview = await asUser(t, admin).query(api.iam.queries.overview, {});
		expect(overview.accounts.map((account) => account.workspaceEmail)).toContain("per@ifinavet.no");
	});
});
