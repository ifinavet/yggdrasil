import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertUser,
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
import { STALLED_MESSAGE } from "./jobs";

let t: TestBackend;
let admin: TestUser;
let emails: ReturnType<typeof spyOnWelcomeEmails>;

beforeEach(async () => {
	vi.useFakeTimers();
	({ t } = await setup());
	admin = await insertUser(t, "leder@ifinavet.no");
	await grantRole(t, admin._id, "admin");
	await configureGoogle();
	configureSlack();
	fakeDirectories();
	emails = spyOnWelcomeEmails();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function onboardingAccount() {
	return t.run((ctx) =>
		ctx.db.insert("memberAccounts", {
			workspaceEmail: "kari.nordmann@ifinavet.no",
			uioEmail: "karinor@uio.no",
			firstName: "Kari",
			lastName: "Nordmann",
			group: "Bedrift",
			stage: "onboarding",
			google: "pending",
			updatedAt: 0,
		}),
	);
}

function scheduleProvision(accountId: Id<"memberAccounts">, cancel: boolean) {
	return t.run(async (ctx) => {
		const jobId = await ctx.scheduler.runAfter(60_000, internal.iam.actions.provision, {
			accountId,
		});
		if (cancel) await ctx.scheduler.cancel(jobId);
		return jobId;
	});
}

describe("watching provisioning jobs", () => {
	it("explains a job that stopped without finishing, and a retry recovers it", async () => {
		const accountId = await onboardingAccount();
		const jobId = await scheduleProvision(accountId, true);

		await t.mutation(internal.iam.jobs.watch, { accountId, jobId });
		expect((await t.run((ctx) => ctx.db.get(accountId)))?.lastError).toBe(STALLED_MESSAGE);

		await asUser(t, admin).mutation(api.iam.mutations.retry, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(emails).toHaveBeenCalledOnce();
		expect(await t.run((ctx) => ctx.db.get(accountId))).toMatchObject({
			welcomeSentAt: expect.any(Number),
		});
		expect((await t.run((ctx) => ctx.db.get(accountId)))?.lastError).toBeUndefined();
	});

	it("keeps watching a job that has not run yet without reporting anything", async () => {
		const accountId = await onboardingAccount();
		const jobId = await scheduleProvision(accountId, false);

		await t.mutation(internal.iam.jobs.watch, { accountId, jobId });

		expect((await t.run((ctx) => ctx.db.get(accountId)))?.lastError).toBeUndefined();
		const watchers = await t.run((ctx) =>
			ctx.db.system
				.query("_scheduled_functions")
				.filter((q) => q.eq(q.field("name"), "iam/jobs:watch"))
				.collect(),
		);
		expect(watchers).toHaveLength(1);
	});
});
