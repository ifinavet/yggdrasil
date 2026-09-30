import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { AccessRole } from "../auth/accessRights";
import { requireLocal } from "../products/localSeed";
import { runJob, STALLED_MESSAGE } from "./jobs";

const SEED_PREFIX = "seed-iam-";
const MAX_ROWS = 500;
const HOUR_MS = 60 * 60 * 1000;

type Person = Readonly<{ firstName: string; lastName: string; workspace: string; uio?: string }>;
type Account = Partial<Doc<"memberAccounts">> & Pick<Doc<"memberAccounts">, "stage" | "google">;

function workspaceEmail(person: Person) {
	return `${person.workspace}@ifinavet.no`;
}

async function insertUser(ctx: MutationCtx, person: Person, email: string) {
	return await ctx.db.insert("users", {
		externalId: `${SEED_PREFIX}${person.workspace}`,
		firstName: person.firstName,
		lastName: person.lastName,
		email,
		image: "",
		locked: false,
	});
}

async function insertAccount(
	ctx: MutationCtx,
	person: Person,
	group: string,
	fields: Account,
	updatedAt: number,
) {
	return await ctx.db.insert("memberAccounts", {
		workspaceEmail: workspaceEmail(person),
		uioEmail: person.uio,
		firstName: person.firstName,
		lastName: person.lastName,
		group,
		updatedAt,
		...fields,
	});
}

async function insertInternal(
	ctx: MutationCtx,
	person: Person,
	group: string,
	role: AccessRole,
	internal: Partial<Doc<"internals">> = {},
) {
	const userId = await insertUser(ctx, person, workspaceEmail(person));
	await ctx.db.insert("internals", { userId, group, position: "Intern", ...internal });
	await ctx.db.insert("accessRights", { userId, role });
	return userId;
}

async function clear(ctx: MutationCtx) {
	const tables = ["memberAccounts", "accessDrift", "accessDriftIgnores", "internals"] as const;
	for (const table of tables) {
		const rows = await ctx.db.query(table).take(MAX_ROWS);
		await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
	}
	const users = await ctx.db.query("users").take(MAX_ROWS * 4);
	const seeded = users.filter((user) => user.externalId?.startsWith("seed-"));
	for (const user of seeded) {
		const rights = await ctx.db
			.query("accessRights")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.take(10);
		await Promise.all(rights.map((row) => ctx.db.delete(row._id)));
		await ctx.db.delete(user._id);
	}
}

export const seed = internalMutation({
	args: {},
	handler: async (ctx) => {
		requireLocal();
		await clear(ctx);
		const now = Date.now();
		const welcomed = now - 30 * 24 * HOUR_MS;

		const active = async (
			person: Person,
			group: string,
			fields: Account,
			role: AccessRole = "internal",
		) => {
			const userId = await insertInternal(
				ctx,
				person,
				group,
				role,
				group === "Styret" ? { position: "Leder", positionEmail: "leder@ifinavet.no" } : {},
			);
			return insertAccount(ctx, person, group, { userId, ...fields }, welcomed);
		};

		await active(
			{ firstName: "Ingrid", lastName: "Berg", workspace: "ingrid.berg", uio: "ingberg@uio.no" },
			"Styret",
			{
				stage: "active",
				google: "existing",
				googleUserId: "google-ingrid.berg@ifinavet.no",
				slackUserId: "U002",
				welcomeSentAt: welcomed,
			},
			"admin",
		);
		await active(
			{ firstName: "Jonas", lastName: "Lie", workspace: "jonas.lie", uio: "jonasli@uio.no" },
			"Bedrift",
			{ stage: "active", google: "created", welcomeSentAt: welcomed },
		);
		await active(
			{ firstName: "Sara", lastName: "Holm", workspace: "sara.holm", uio: "saraho@uio.no" },
			"Arrangement",
			{ stage: "active", google: "created", slackUserId: "U004", welcomeSentAt: welcomed },
		);
		await active(
			{ firstName: "Nora", lastName: "Vik", workspace: "nora.vik", uio: "noravi@uio.no" },
			"Kommunikasjon",
			{ stage: "active", google: "created", lastError: STALLED_MESSAGE },
		);
		await insertInternal(
			ctx,
			{ firstName: "Eirik", lastName: "Sand", workspace: "eirik.sand" },
			"Webgruppen",
			"internal",
		);

		const provisionNow: Id<"memberAccounts">[] = [
			await insertAccount(
				ctx,
				{ firstName: "Emma", lastName: "Dahl", workspace: "emma.dahl", uio: "emmada@uio.no" },
				"Bedrift",
				{ stage: "onboarding", google: "pending" },
				now,
			),
			await insertAccount(
				ctx,
				{ firstName: "Ola", lastName: "Nordmann", workspace: "ola.nordmann", uio: "olanor@uio.no" },
				"Arrangement",
				{ stage: "onboarding", google: "pending" },
				now,
			),
			await insertAccount(
				ctx,
				{ firstName: "Kristine", lastName: "Ås", workspace: "kristine.as", uio: "kristas@uio.no" },
				"Økonomi",
				{ stage: "onboarding", google: "pending" },
				now,
			),
		];
		await insertAccount(
			ctx,
			{ firstName: "Henrik", lastName: "Moe", workspace: "henrik.moe", uio: "henrimo@uio.no" },
			"Webgruppen",
			{ stage: "onboarding", google: "pending", lastError: STALLED_MESSAGE },
			now - 2 * HOUR_MS,
		);

		await insertAccount(
			ctx,
			{ firstName: "Lars", lastName: "Ek", workspace: "lars.ek", uio: "larsek@uio.no" },
			"Bedrift",
			{
				stage: "offboarding",
				google: "created",
				welcomeSentAt: welcomed,
				lastError: "Google svarte ikke. Prøv igjen senere.",
			},
			now - HOUR_MS,
		);
		await insertAccount(
			ctx,
			{ firstName: "Per", lastName: "Hansen", workspace: "per.hansen", uio: "perhan@uio.no" },
			"Arrangement",
			{ stage: "offboarded", google: "suspended", slackUserId: "U005", welcomeSentAt: welcomed },
			now - 3 * 24 * HOUR_MS,
		);
		await insertAccount(
			ctx,
			{ firstName: "Mia", lastName: "Strand", workspace: "mia.strand", uio: "miast@uio.no" },
			"Kommunikasjon",
			{ stage: "offboarded", google: "suspended", slackUserId: "U006", welcomeSentAt: welcomed },
			now - 5 * 24 * HOUR_MS,
		);
		await insertAccount(
			ctx,
			{ firstName: "Kristian", lastName: "Moe", workspace: "kristian.moe", uio: "krismo@uio.no" },
			"Bedrift",
			{
				stage: "offboarded",
				google: "suspended",
				slackUserId: "U009",
				slackDeactivatedAt: now - 24 * HOUR_MS,
				welcomeSentAt: welcomed,
			},
			now - 7 * 24 * HOUR_MS,
		);
		await insertAccount(
			ctx,
			{ firstName: "Hanna", lastName: "Lund", workspace: "hanna.lund", uio: "hannalu@uio.no" },
			"Økonomi",
			{
				stage: "cancelled",
				google: "created",
				lastError: "Google svarte ikke. Prøv igjen senere.",
			},
			now - 4 * HOUR_MS,
		);

		const students: Person[] = [
			{
				firstName: "Kari",
				lastName: "Nordmann",
				workspace: "kari.nordmann",
				uio: "karinor@uio.no",
			},
			{ firstName: "Magnus", lastName: "Berg", workspace: "magnus.berg", uio: "magnube@uio.no" },
			{ firstName: "Thea", lastName: "Solli", workspace: "thea.solli", uio: "theaso@uio.no" },
		];
		for (const student of students) await insertUser(ctx, student, student.uio ?? "");

		for (const accountId of provisionNow) await runJob(ctx, "provision", accountId);
	},
});
