import type { UserJSON } from "@clerk/backend";
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

const newMember = {
	firstName: "Kari",
	lastName: "Nordmann",
	uioEmail: "karinor@uio.no",
	workspaceEmail: "kari.nordmann@ifinavet.no",
	group: "Bedrift",
};

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

async function onboard(overrides: Partial<typeof newMember> = {}) {
	const result = await asUser(t, admin).mutation(api.iam.mutations.startOnboarding, {
		...newMember,
		...overrides,
	});
	await t.finishAllScheduledFunctions(vi.runAllTimers);
	return result;
}

function account(accountId: Id<"memberAccounts">) {
	return t.run((ctx) => ctx.db.get(accountId));
}

function sentEmail() {
	expect(emails).toHaveBeenCalledOnce();
	const options = emails.mock.calls[0]?.[1];
	if (typeof options !== "object") throw new Error("Expected email options");
	return options as { to: string; html: string; replyTo?: string[] };
}

function clerkUser(externalId: string, email: string): UserJSON {
	return {
		id: externalId,
		email_addresses: [{ id: "email-1", email_address: email }],
		primary_email_address_id: "email-1",
		first_name: "Kari",
		last_name: "Nordmann",
		image_url: "",
		locked: false,
	} as unknown as UserJSON;
}

describe("starting onboarding", () => {
	it("refuses members without an admin role", async () => {
		const member = await insertUser(t, "intern@ifinavet.no");
		await grantRole(t, member._id, "internal");

		await expect(
			asUser(t, member).mutation(api.iam.mutations.startOnboarding, newMember),
		).rejects.toThrow();
	});

	it("requires the UiO address and the workspace domain", async () => {
		const client = asUser(t, admin);

		expect(
			await refusalMessageFrom(
				client.mutation(api.iam.mutations.startOnboarding, {
					...newMember,
					uioEmail: "kari@gmail.com",
				}),
			),
		).toBe("Bruk UiO-adressen, den som slutter på uio.no.");
		expect(
			await refusalMessageFrom(
				client.mutation(api.iam.mutations.startOnboarding, {
					...newMember,
					workspaceEmail: "kari@gmail.com",
				}),
			),
		).toBe("Adressen må slutte på @ifinavet.no.");
	});

	it("creates the Google account and mails the credentials to the UiO address", async () => {
		const { accountId, activated } = await onboard();

		const created = directories.google.get(newMember.workspaceEmail);
		expect(created).toMatchObject({ name: "Kari Nordmann", suspended: false });
		const email = sentEmail();
		expect(email.to).toBe(newMember.uioEmail);
		expect(email.replyTo).toEqual(["leder@ifinavet.no"]);
		expect(email.html).toContain(newMember.workspaceEmail);
		expect(email.html).toContain(created?.password);
		expect(email.html).toContain("https://join.slack.com/t/navet/shared_invite/test");
		expect(activated).toBe(false);
		expect(await account(accountId)).toMatchObject({
			stage: "onboarding",
			google: "created",
			welcomeSentAt: expect.any(Number),
		});
		expect((await account(accountId))?.lastError).toBeUndefined();
	});

	async function confirm(accountId: Id<"memberAccounts">) {
		await asUser(t, admin).mutation(api.iam.mutations.confirmGoogleAccount, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	}

	it("reuses an active Google account that belongs to the same person without touching it", async () => {
		directories.google.set(newMember.workspaceEmail, {
			name: "Kari Nordmann",
			suspended: false,
			password: "hennes-eget",
			signedIn: true,
		});

		const { accountId } = await onboard();

		expect(directories.google.get(newMember.workspaceEmail)?.password).toBe("hennes-eget");
		expect(sentEmail().html).toContain("det samme som før");
		expect(await account(accountId)).toMatchObject({ google: "existing" });
		expect((await account(accountId))?.lastError).toBeUndefined();
	});

	it("waits for an admin before reopening a suspended account, even with the same name", async () => {
		directories.google.set(newMember.workspaceEmail, {
			name: "Kari Nordmann",
			suspended: true,
			password: "hennes-eget",
			signedIn: true,
		});

		const { accountId } = await onboard();

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(true);
		expect(emails).not.toHaveBeenCalled();
		expect(await account(accountId)).toMatchObject({ googleOwner: "Kari Nordmann" });

		await confirm(accountId);

		expect(directories.google.get(newMember.workspaceEmail)).toMatchObject({
			suspended: false,
			password: "hennes-eget",
		});
		expect(sentEmail().html).toContain("det samme som før");
		expect(await account(accountId)).toMatchObject({ google: "existing" });
		expect((await account(accountId))?.googleOwner).toBeUndefined();
		expect((await account(accountId))?.lastError).toBeUndefined();
	});

	it("only resets the password of a never used account after an admin confirms it", async () => {
		directories.google.set(newMember.workspaceEmail, {
			name: "Kari Nordmann",
			suspended: false,
			password: "ukjent",
		});

		const { accountId } = await onboard();
		expect(directories.google.get(newMember.workspaceEmail)?.password).toBe("ukjent");
		expect(emails).not.toHaveBeenCalled();

		await confirm(accountId);

		const password = directories.google.get(newMember.workspaceEmail)?.password;
		expect(password).not.toBe("ukjent");
		expect(sentEmail().html).toContain(password);
		expect(await account(accountId)).toMatchObject({ google: "existing" });
	});

	it("never reopens a suspended account that belongs to someone else on its own", async () => {
		directories.google.set(newMember.workspaceEmail, {
			name: "Kari Hansen",
			suspended: true,
			signedIn: true,
		});

		const { accountId } = await onboard();

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(true);
		expect(emails).not.toHaveBeenCalled();
		expect(await account(accountId)).toMatchObject({ googleOwner: "Kari Hansen" });
	});

	it("lets an admin confirm the Google account of a member who is already signed in", async () => {
		await insertUser(t, newMember.uioEmail);
		directories.google.set(newMember.workspaceEmail, {
			name: "Kari Nordmann",
			suspended: false,
			password: "ukjent",
		});

		const { accountId } = await onboard();
		expect(await account(accountId)).toMatchObject({
			stage: "active",
			googleOwner: "Kari Nordmann",
		});

		await confirm(accountId);

		expect(directories.google.get(newMember.workspaceEmail)?.password).not.toBe("ukjent");
		expect(await account(accountId)).toMatchObject({ welcomeSentAt: expect.any(Number) });
	});

	it("refuses to confirm when there is no existing Google account to confirm", async () => {
		const { accountId } = await onboard();

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.confirmGoogleAccount, { accountId }),
			),
		).toBe("Det er ingen eksisterende Google-konto å bekrefte.");
	});

	it("refuses a retry while the first attempt is still running", async () => {
		const { accountId } = await asUser(t, admin).mutation(
			api.iam.mutations.startOnboarding,
			newMember,
		);

		expect(
			await refusalMessageFrom(asUser(t, admin).mutation(api.iam.mutations.retry, { accountId })),
		).toBe("Dette kjører allerede. Vent litt.");
		await t.finishAllScheduledFunctions(vi.runAllTimers);
	});

	it("stops without mailing anyone when the address belongs to someone else", async () => {
		directories.google.set(newMember.workspaceEmail, { name: "Kari Hansen", suspended: false });

		const { accountId } = await onboard();

		expect(emails).not.toHaveBeenCalled();
		expect((await account(accountId))?.lastError).toBe(
			"kari.nordmann@ifinavet.no finnes allerede i Google Workspace med navnet Kari Hansen. Bruk den bare hvis den tilhører Kari Nordmann.",
		);
	});

	it("resets the password on retry when the welcome email failed after the account was created", async () => {
		emails.mockRejectedValueOnce(new Error("Resend er nede."));
		const { accountId } = await onboard();
		const firstPassword = directories.google.get(newMember.workspaceEmail)?.password;
		expect(await account(accountId)).toMatchObject({
			google: "created",
			lastError: "Resend er nede.",
		});

		await asUser(t, admin).mutation(api.iam.mutations.retry, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const secondPassword = directories.google.get(newMember.workspaceEmail)?.password;
		expect(secondPassword).not.toBe(firstPassword);
		expect(emails.mock.calls[1]?.[1]).toMatchObject({
			html: expect.stringContaining(String(secondPassword)),
		});
		expect(await account(accountId)).toMatchObject({ welcomeSentAt: expect.any(Number) });
		expect((await account(accountId))?.lastError).toBeUndefined();
	});

	it("explains that Google is not connected when the keys are missing", async () => {
		vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "");

		const { accountId } = await onboard();

		expect(emails).not.toHaveBeenCalled();
		expect((await account(accountId))?.lastError).toBe("Google Workspace er ikke koblet til ennå.");
	});

	it("refuses people who are already added or already internal", async () => {
		await onboard();
		const client = asUser(t, admin);
		expect(
			await refusalMessageFrom(
				client.mutation(api.iam.mutations.startOnboarding, {
					...newMember,
					workspaceEmail: "kari@ifinavet.no",
				}),
			),
		).toBe("kari.nordmann@ifinavet.no er allerede lagt til.");

		const existing = await insertUser(t, "ola@uio.no");
		await t.run((ctx) =>
			ctx.db.insert("internals", { userId: existing._id, group: "Styret", position: "Leder" }),
		);
		expect(
			await refusalMessageFrom(
				client.mutation(api.iam.mutations.startOnboarding, {
					...newMember,
					uioEmail: "ola@uio.no",
					workspaceEmail: "ola@ifinavet.no",
				}),
			),
		).toBe("ola@uio.no er allerede internt medlem.");
	});

	it("recognizes a signed-in member whatever the case of their address", async () => {
		await t.mutation(internal.users.clerk.mutations.upsertFromClerk, {
			data: clerkUser("clerk-kari", newMember.uioEmail.toUpperCase()),
		});

		const { activated } = await onboard();

		expect(activated).toBe(true);
	});

	it("makes someone internal right away when they already have a Bifrost user", async () => {
		const existing = await insertUser(t, newMember.uioEmail);

		const { accountId, activated } = await onboard();

		expect(activated).toBe(true);
		expect(await account(accountId)).toMatchObject({ stage: "active", userId: existing._id });
		const [internalMember, role] = await t.run(async (ctx) => [
			await ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", existing._id))
				.first(),
			await ctx.db
				.query("accessRights")
				.withIndex("by_userId", (q) => q.eq("userId", existing._id))
				.first(),
		]);
		expect(internalMember).toMatchObject({ group: "Bedrift", position: "Intern" });
		expect(role).toMatchObject({ role: "internal" });
	});

	it("lists each internal with the connections of their account", async () => {
		const existing = await insertUser(t, newMember.uioEmail);
		const legacy = await insertUser(t, "gammel@ifinavet.no");
		await t.run((ctx) =>
			ctx.db.insert("internals", { userId: legacy._id, group: "Styret", position: "Intern" }),
		);
		await onboard();

		const internals = await asUser(t, admin).query(
			api.users.organization.queries.getAllInternals,
			{},
		);

		expect(internals.find((row) => row.userId === existing._id)?.connections).toEqual({
			uioEmail: newMember.uioEmail,
			google: "created",
			welcomeSent: true,
			slackLinked: false,
		});
		expect(internals.find((row) => row.userId === legacy._id)?.connections).toBeNull();
	});

	it("refuses addresses that belong to two different former members", async () => {
		const first = await onboard();
		await t.run((ctx) =>
			ctx.db.patch(first.accountId, { stage: "offboarded", google: "suspended" }),
		);
		const second = await onboard({
			uioEmail: "olanor@uio.no",
			workspaceEmail: "ola.nordmann@ifinavet.no",
		});
		await t.run((ctx) =>
			ctx.db.patch(second.accountId, { stage: "offboarded", google: "suspended" }),
		);

		expect(
			await refusalMessageFrom(
				asUser(t, admin).mutation(api.iam.mutations.startOnboarding, {
					...newMember,
					uioEmail: "olanor@uio.no",
				}),
			),
		).toBe(
			"kari.nordmann@ifinavet.no og olanor@uio.no hører til to forskjellige tidligere medlemmer. Sjekk adressene.",
		);
	});

	it("reuses the record of a former member instead of creating a duplicate", async () => {
		const { accountId } = await onboard();
		await t.run((ctx) => ctx.db.patch(accountId, { stage: "offboarded", google: "suspended" }));

		const again = await onboard({ group: "Arrangement" });

		expect(again.accountId).toBe(accountId);
		expect(await account(accountId)).toMatchObject({ stage: "onboarding", group: "Arrangement" });
		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(false);
	});
});

describe("activating on first sign-in", () => {
	it("makes the member internal when they sign in with either address", async () => {
		const { accountId } = await onboard();

		await t.mutation(internal.users.clerk.mutations.upsertFromClerk, {
			data: clerkUser("clerk-kari", newMember.workspaceEmail),
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		const stored = await account(accountId);
		expect(stored?.stage).toBe("active");
		const internals = await t.run((ctx) =>
			ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", stored?.userId as Id<"users">))
				.collect(),
		);
		expect(internals).toHaveLength(1);
	});

	it("leaves ordinary students alone", async () => {
		await t.mutation(internal.users.clerk.mutations.upsertFromClerk, {
			data: clerkUser("clerk-student", "student@uio.no"),
		});

		expect(await t.run((ctx) => ctx.db.query("internals").collect())).toHaveLength(0);
	});
});

describe("linking the UiO and ifinavet logins", () => {
	async function hasInternalAccess(user: TestUser) {
		return asUser(t, user).query(api.auth.accessRights.checkRights, { right: ["internal"] });
	}

	async function promoteStudent() {
		const student = await insertUser(t, newMember.uioEmail);
		await onboard();
		return { student, workspaceUser: await insertUser(t, newMember.workspaceEmail) };
	}

	it("gives the ifinavet login the access of the promoted UiO user", async () => {
		const { student, workspaceUser } = await promoteStudent();

		expect(await hasInternalAccess(student)).toBe(true);
		expect(await hasInternalAccess(workspaceUser)).toBe(true);
		expect(await t.run((ctx) => ctx.db.query("internals").collect())).toHaveLength(1);
	});

	it("follows role changes on the promoted user", async () => {
		const { student, workspaceUser } = await promoteStudent();

		const superAdmin = await insertUser(t, "web@ifinavet.no");
		await grantRole(t, superAdmin._id, "super-admin");
		await asUser(t, superAdmin).mutation(api.auth.accessRights.upsertAccessRights, {
			userId: student._id,
			role: "admin",
		});

		expect(
			await asUser(t, workspaceUser).query(api.auth.accessRights.checkRights, {
				right: ["admin"],
			}),
		).toBe(true);
	});

	it("takes access from both logins when the member is removed", async () => {
		const { student, workspaceUser } = await promoteStudent();
		const internalMember = await t.run((ctx) =>
			ctx.db
				.query("internals")
				.withIndex("by_userId", (q) => q.eq("userId", student._id))
				.first(),
		);

		await asUser(t, admin).mutation(api.users.organization.mutations.removeInternal, {
			id: internalMember?._id as Id<"internals">,
		});

		expect(await hasInternalAccess(student)).toBe(false);
		expect(await hasInternalAccess(workspaceUser)).toBe(false);
	});

	it("gives nothing to a login whose address has no member account", async () => {
		await promoteStudent();
		const stranger = await insertUser(t, "annen@uio.no");

		expect(await hasInternalAccess(stranger)).toBe(false);
	});
});

describe("cancelling onboarding", () => {
	it("suspends the account we created", async () => {
		const { accountId } = await onboard();

		await asUser(t, admin).mutation(api.iam.mutations.cancelOnboarding, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(true);
		expect(await account(accountId)).toMatchObject({ stage: "cancelled", google: "suspended" });
	});

	it("still finds the account by its Google id after the address was renamed in Google", async () => {
		const { accountId } = await onboard();
		expect(await account(accountId)).toMatchObject({
			googleUserId: `google-${newMember.workspaceEmail}`,
		});
		directories.renameGoogle(newMember.workspaceEmail, "kari.hansen@ifinavet.no", false);

		await asUser(t, admin).mutation(api.iam.mutations.cancelOnboarding, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(directories.google.get("kari.hansen@ifinavet.no")?.suspended).toBe(true);
		expect(await account(accountId)).toMatchObject({
			google: "suspended",
			workspaceEmail: "kari.hansen@ifinavet.no",
		});
	});

	it("suspends the account when cancelled while it was being created", async () => {
		const { accountId } = await asUser(t, admin).mutation(
			api.iam.mutations.startOnboarding,
			newMember,
		);
		const directoryFetch = globalThis.fetch;
		vi.stubGlobal("fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
			if (init.method === "POST" && String(input).startsWith("https://admin.googleapis.com")) {
				await asUser(t, admin).mutation(api.iam.mutations.cancelOnboarding, { accountId });
			}
			return directoryFetch(input, init);
		});

		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(true);
		expect(await account(accountId)).toMatchObject({ stage: "cancelled", google: "suspended" });
		expect(emails).not.toHaveBeenCalled();
	});

	it("never suspends an account that existed before", async () => {
		directories.google.set(newMember.workspaceEmail, { name: "Kari Nordmann", suspended: false });
		const { accountId } = await onboard();

		await asUser(t, admin).mutation(api.iam.mutations.cancelOnboarding, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(false);
	});

	async function onboardWithSuspendedAccount() {
		directories.google.set(newMember.workspaceEmail, {
			name: "Kari Nordmann",
			suspended: true,
			signedIn: true,
		});
		const { accountId } = await onboard();
		await asUser(t, admin).mutation(api.iam.mutations.confirmGoogleAccount, { accountId });
		return accountId;
	}

	it("suspends a reactivated account again", async () => {
		const accountId = await onboardWithSuspendedAccount();
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(false);

		await asUser(t, admin).mutation(api.iam.mutations.cancelOnboarding, { accountId });
		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(true);
		expect(await account(accountId)).toMatchObject({ stage: "cancelled", google: "suspended" });
	});

	it("suspends a reactivated account again when cancelled while it was being reactivated", async () => {
		const accountId = await onboardWithSuspendedAccount();
		const directoryFetch = globalThis.fetch;
		vi.stubGlobal("fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
			const response = await directoryFetch(input, init);
			if (init.method === "PATCH" && String(init.body).includes('"suspended":false')) {
				await asUser(t, admin).mutation(api.iam.mutations.cancelOnboarding, { accountId });
			}
			return response;
		});

		await t.finishAllScheduledFunctions(vi.runAllTimers);

		expect(directories.google.get(newMember.workspaceEmail)?.suspended).toBe(true);
		expect(await account(accountId)).toMatchObject({ stage: "cancelled", google: "suspended" });
		expect(emails).not.toHaveBeenCalled();
	});
});
