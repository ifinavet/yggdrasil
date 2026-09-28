import { eventSemesterRange } from "@workspace/shared/time";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { adminRoles, internalRoles, requireRole } from "../auth/accessRights";
import { eventSemesterValidator } from "../events/queries";
import { rankBy } from "./ranking";

const MAX_INTERNALS = 500;
const MAX_EVENTS_PER_INTERNAL = 2000;

type Scope = { now: number; start?: number; end?: number };

function eventScope(ctx: QueryCtx, scope: Scope) {
	const inScope = new Map<Id<"events">, Promise<boolean>>();
	return (eventId: Id<"events">) => {
		const cached = inScope.get(eventId);
		if (cached) return cached;
		const result = ctx.db.get(eventId).then((event) => {
			if (!event || event.eventStart > scope.now) return false;
			if (scope.start !== undefined && event.eventStart < scope.start) return false;
			return scope.end === undefined || event.eventStart < scope.end;
		});
		inScope.set(eventId, result);
		return result;
	};
}

async function countInScope(
	eventIds: Id<"events">[],
	isInScope: (id: Id<"events">) => Promise<boolean>,
) {
	const unique = [...new Set(eventIds)];
	const flags = await Promise.all(unique.map(isInScope));
	return flags.filter(Boolean).length;
}

export const internals = query({
	args: {
		now: v.number(),
		semester: v.optional(v.object({ semester: eventSemesterValidator, year: v.number() })),
	},
	handler: async (ctx, { now, semester }) => {
		await requireRole(ctx, internalRoles);
		const range = semester ? eventSemesterRange(semester.semester, semester.year) : {};
		const isInScope = eventScope(ctx, { now, ...range });

		const [internalDocs, ...adminDocs] = await Promise.all([
			ctx.db.query("internals").take(MAX_INTERNALS),
			...adminRoles.map((role) =>
				ctx.db
					.query("accessRights")
					.withIndex("by_role", (q) => q.eq("role", role))
					.take(MAX_INTERNALS),
			),
		]);
		const userIds = [
			...new Set([...internalDocs, ...adminDocs.flat()].map(({ userId }) => userId)),
		];

		const members = await Promise.all(
			userIds.map(async (userId) => {
				const user = await ctx.db.get(userId);
				if (!user || user.deleted) return null;

				const [registrations, organizers] = await Promise.all([
					ctx.db
						.query("registrations")
						.withIndex("by_userId", (q) => q.eq("userId", userId))
						.take(MAX_EVENTS_PER_INTERNAL),
					ctx.db
						.query("eventOrganizers")
						.withIndex("by_userId", (q) => q.eq("userId", userId))
						.take(MAX_EVENTS_PER_INTERNAL),
				]);
				const attendedIds = registrations
					.filter(
						({ attendanceStatus }) =>
							attendanceStatus === "confirmed" || attendanceStatus === "late",
					)
					.map(({ eventId }) => eventId);

				return {
					member: { userId, name: `${user.firstName} ${user.lastName}`, image: user.image },
					attended: await countInScope(attendedIds, isInScope),
					organized: await countInScope(
						organizers.map(({ eventId }) => eventId),
						isInScope,
					),
				};
			}),
		);

		const present = members.filter((member) => member !== null);
		const board = (key: "attended" | "organized") =>
			rankBy(present, (member) => member[key]).map(({ member, count, rank }) => ({
				...member,
				count,
				rank,
			}));

		return { attended: board("attended"), organized: board("organized") };
	},
});
