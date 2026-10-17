import { z } from "zod";
import { applicationDraftSchema } from "./company-application";
import { readJson, removeItem, writeJson } from "./guarded-storage";

// Browser storage for the application form. Every access is guarded: storage can be missing,
// full or blocked. What is read back is parsed, never trusted.

const DRAFT_KEY = "hugin.company-application.drafts.v2";
// The single draft saved before drafts were kept per semester. Read once, then written under DRAFT_KEY.
const LEGACY_DRAFT_KEY = "hugin.company-application.draft.v1";

/** A saved, unsent application. It belongs to one semester and carries its one-time id. */
const storedDraftSchema = z.object({
	semesterId: z.string(),
	submissionId: z.string(),
	values: applicationDraftSchema,
});

export type StoredDraft = z.infer<typeof storedDraftSchema>;

/** One draft per semester, and which semester the company worked on last. */
const storedDraftsSchema = z.object({
	lastSemesterId: z.string(),
	drafts: z.record(z.string(), storedDraftSchema),
});

/** A new one-time id for a draft, so a retried submit saves one application. */
export function newSubmissionId(): string {
	return crypto.randomUUID();
}

const local = () => window.localStorage;

function readStoredDrafts(): z.infer<typeof storedDraftsSchema> | null {
	const stored = storedDraftsSchema.safeParse(readJson(local, DRAFT_KEY));
	if (stored.success) return stored.data;
	const legacy = storedDraftSchema.safeParse(readJson(local, LEGACY_DRAFT_KEY));
	if (!legacy.success) return null;
	return {
		lastSemesterId: legacy.data.semesterId,
		drafts: { [legacy.data.semesterId]: legacy.data },
	};
}

/** The semester the company worked on last, if a draft is saved. */
export function storedDraftSemesterId(): string | null {
	return readStoredDrafts()?.lastSemesterId ?? null;
}

/**
 * The saved draft for this semester. With no draft for it, the answers from the semester the
 * company worked on last are carried over with a new one-time id and no dates, since dates belong
 * to a semester. Unreadable answers come back unanswered.
 */
export function loadDraft(semesterId: string): StoredDraft | null {
	const stored = readStoredDrafts();
	if (!stored) return null;
	const own = stored.drafts[semesterId];
	if (own) return own;
	const last = stored.drafts[stored.lastSemesterId];
	if (!last) return null;
	return {
		semesterId,
		submissionId: newSubmissionId(),
		values: { ...last.values, availableDates: [] },
	};
}

export function saveDraft(draft: StoredDraft): void {
	const drafts = readStoredDrafts()?.drafts ?? {};
	const saved = writeJson(local, DRAFT_KEY, {
		lastSemesterId: draft.semesterId,
		drafts: { ...drafts, [draft.semesterId]: draft },
	});
	// The old draft may be the only one saved, so it goes only once the new one is written.
	if (saved) removeItem(local, LEGACY_DRAFT_KEY);
}

/** Forgets the draft for a sent application. Drafts for other semesters are kept. */
export function clearDraft(semesterId: string): void {
	const stored = readStoredDrafts();
	const { [semesterId]: _sent, ...drafts } = stored?.drafts ?? {};
	const remaining = Object.keys(drafts);
	removeItem(local, LEGACY_DRAFT_KEY);
	if (!stored || remaining.length === 0) {
		removeItem(local, DRAFT_KEY);
		return;
	}
	writeJson(local, DRAFT_KEY, {
		lastSemesterId: remaining.includes(stored.lastSemesterId)
			? stored.lastSemesterId
			: (remaining[0] as string),
		drafts,
	});
}
