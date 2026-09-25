import { MAX_HELPERS } from "./limits";

/** The kontaktperson and medhjelpere from Navet for one application, as far as they are chosen. */
export type TeamProposal<Key, UserId extends string> = {
	id: Key;
	responsibleUserId?: UserId;
	helperUserIds: UserId[];
};

/**
 * Proposes a kontaktperson and up to MAX_HELPERS medhjelpere for each application. Someone already
 * chosen is kept, nobody is picked twice for one application, and each pick is the candidate with
 * the fewest events, counting those already chosen here and picks made earlier in the run. Ties go
 * to the lowest user id, so the result is the same every time. With too few candidates, as much as
 * possible is filled.
 *
 * @param {object[]} applications - The applications, with anyone already chosen.
 * @param {UserId[]} candidates - Who can be picked.
 * @param {ReadonlyMap<UserId, number>} load - How many events each person already organizes.
 *
 * @returns {TeamProposal[]} - The proposed team for each application, in the same order.
 */
export function proposeTeams<Key, UserId extends string>(
	applications: { id: Key; responsibleUserId?: UserId; helperUserIds?: UserId[] }[],
	candidates: UserId[],
	load: ReadonlyMap<UserId, number>,
): TeamProposal<Key, UserId>[] {
	const count = new Map(load);
	const add = (userId: UserId) => count.set(userId, (count.get(userId) ?? 0) + 1);
	for (const { responsibleUserId, helperUserIds = [] } of applications) {
		for (const userId of [responsibleUserId, ...helperUserIds]) if (userId) add(userId);
	}
	const pick = (taken: (UserId | undefined)[]) => {
		const [best] = candidates
			.filter((userId) => !taken.includes(userId))
			.sort((a, b) => (count.get(a) ?? 0) - (count.get(b) ?? 0) || a.localeCompare(b));
		if (best) add(best);
		return best;
	};

	return applications.map(({ id, responsibleUserId, helperUserIds = [] }) => {
		const responsible = responsibleUserId ?? pick(helperUserIds);
		const helpers = [...helperUserIds];
		while (helpers.length < MAX_HELPERS) {
			const helper = pick([responsible, ...helpers]);
			if (!helper) break;
			helpers.push(helper);
		}
		return {
			id,
			...(responsible ? { responsibleUserId: responsible } : {}),
			helperUserIds: helpers,
		};
	});
}
