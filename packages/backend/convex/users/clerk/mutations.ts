import type { UserJSON } from "@clerk/backend";
import { ConvexError, type Validator, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../../_generated/server";
import { fillOpenSeats } from "../../events/registrations/mutations";
import { userByExternalId } from "./queries";

const ANONYMIZED_USER = {
	email: "",
	firstName: "Slettet",
	lastName: "bruker",
	image: "",
	locked: true,
	deleted: true,
};

async function hashClerkId(externalId: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(externalId));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function wasDeleted(ctx: MutationCtx, externalId: string): Promise<boolean> {
	const hash = await hashClerkId(externalId);
	return (
		(await ctx.db
			.query("deletedClerkUsers")
			.withIndex("by_externalIdHash", (q) => q.eq("externalIdHash", hash))
			.unique()) !== null
	);
}

/**
 * Creates or updates a user from a Clerk webhook payload.
 *
 * @param {UserJSON} data - The Clerk user payload.
 *
 * @returns {null} - Returns null when the user has been synchronized successfully.
 */
export const upsertFromClerk = internalMutation({
	args: { data: v.any() as Validator<UserJSON> }, // no runtime validation, trust Clerk
	async handler(ctx, { data }) {
		if (await wasDeleted(ctx, data.id)) return;

		const email = data.email_addresses.find(
			(emailAddress) => emailAddress.id === data.primary_email_address_id,
		)?.email_address;
		const userAttributes = {
			email: email ?? data.email_addresses[0]?.email_address ?? "",
			firstName: data.first_name ?? "",
			lastName: data.last_name ?? "",
			image: data.image_url ?? "",
			externalId: data.id,
			locked: data.locked,
		};

		const user = await userByExternalId(ctx, data.id);
		if (user === null) {
			await ctx.db.insert("users", userAttributes);
		} else {
			await ctx.db.patch(user._id, userAttributes);
		}
	},
});

/**
 * Creates a user for an external id if none exists yet.
 *
 * @param {string} externalId - The external auth provider id.
 * @param {string} firstName - The user's first name.
 * @param {string} lastName - The user's last name.
 * @param {string} email - The user's email address.
 * @param {string} image - The user's profile image URL.
 *
 * @returns {Id<"users">} - The existing or newly created user id.
 */
export const createIfNotExists = internalMutation({
	args: {
		externalId: v.string(),
		firstName: v.string(),
		lastName: v.string(),
		email: v.string(),
		image: v.string(),
	},
	handler: async (ctx, { externalId, firstName, lastName, email, image }) => {
		if (await wasDeleted(ctx, externalId)) {
			throw new ConvexError("Denne brukeren er slettet.");
		}
		const user = await userByExternalId(ctx, externalId);

		if (!user) {
			console.warn(`User for externalId ${externalId} not found, creating...`);
			// Create user
			const id = await ctx.db.insert("users", {
				externalId,
				email,
				firstName,
				lastName,
				image,
				locked: false,
			});

			return id;
		}

		return user._id;
	},
});

async function revokeAccessRights(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const assignedRights = await ctx.db
		.query("accessRights")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	await Promise.all(assignedRights.map((right) => ctx.db.delete(right._id)));
}

async function removeInternalPositions(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const positions = await ctx.db
		.query("internals")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	await Promise.all(positions.map((position) => ctx.db.delete(position._id)));

	const groups = await ctx.db
		.query("internalGroups")
		.filter((q) => q.eq(q.field("leader"), userId))
		.collect();
	await Promise.all(groups.map((group) => ctx.db.patch(group._id, { leader: undefined })));
}

async function removeStudentProfiles(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const profiles = await ctx.db
		.query("students")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();

	for (const profile of profiles) {
		const points = await ctx.db
			.query("points")
			.withIndex("by_studentId", (q) => q.eq("studentId", profile._id))
			.collect();

		await Promise.all(points.map((point) => ctx.db.delete(point._id)));
		await ctx.db.delete(profile._id);
	}
}

async function cleanRegistrations(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
	const eventsToRefill = new Map<Id<"events">, Doc<"events">>();
	const registrations = await ctx.db
		.query("registrations")
		.withIndex("by_userId", (q) => q.eq("userId", userId))
		.collect();
	for (const registration of registrations) {
		const event = await ctx.db.get(registration.eventId);
		if (!event || event.eventStart > Date.now()) {
			await ctx.db.delete(registration._id);
			if (event) eventsToRefill.set(event._id, event);
		} else {
			await ctx.db.patch(registration._id, { note: undefined });
		}
	}
	for (const event of eventsToRefill.values()) await fillOpenSeats(ctx, event);
}

// Feedback has no author index. Scan bounded batches, keeping only the hash in scheduled work.
export const anonymizeFormResponses = internalMutation({
	args: { externalIdHash: v.string(), cursor: v.union(v.string(), v.null()) },
	handler: async (ctx, { externalIdHash, cursor }): Promise<void> => {
		const responses = await ctx.db.query("formResponses").paginate({ cursor, numItems: 100 });
		for (const response of responses.page) {
			const { userId, ...data } = response.data;
			if (typeof userId === "string" && (await hashClerkId(userId)) === externalIdHash) {
				await ctx.db.patch(response._id, { data });
			}
		}
		if (!responses.isDone) {
			await ctx.scheduler.runAfter(0, internal.users.clerk.mutations.anonymizeFormResponses, {
				externalIdHash,
				cursor: responses.continueCursor,
			});
		}
	},
});

/**
 * Anonymizes a user that was deleted in Clerk and removes their personal records.
 *
 * Event history keeps pointing at the anonymized user, so no reader is left with a dangling reference.
 *
 * @param {string} clerkUserId - The Clerk user id that was deleted.
 *
 * @returns {null} - Returns null after recording the deletion and anonymizing any matching user.
 */
export const deleteFromClerk = internalMutation({
	args: { clerkUserId: v.string() },
	async handler(ctx, { clerkUserId }) {
		if (await wasDeleted(ctx, clerkUserId)) return;
		const externalIdHash = await hashClerkId(clerkUserId);
		await ctx.db.insert("deletedClerkUsers", { externalIdHash });
		await ctx.runMutation(internal.users.clerk.mutations.anonymizeFormResponses, {
			externalIdHash,
			cursor: null,
		});
		const user = await userByExternalId(ctx, clerkUserId);

		if (user === null) return;

		await revokeAccessRights(ctx, user._id);
		await removeInternalPositions(ctx, user._id);
		await removeStudentProfiles(ctx, user._id);

		await ctx.db.patch(user._id, {
			...ANONYMIZED_USER,
			externalId: `deleted:${user._id}`,
		});
		await cleanRegistrations(ctx, user._id);
	},
});
