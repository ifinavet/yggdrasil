import {
	type ApplicationForm,
	applicationFormSchema,
} from "@workspace/shared/semester/application";
import { z } from "zod";
import { applicationDraftSchema, type ChosenCompany } from "./company-application";

// Browser storage for the application form. Every access is guarded: storage can be missing,
// full or blocked. What is read back is parsed, never trusted.

const DRAFT_KEY = "hugin.company-application.draft.v1";
const RECEIPT_KEY = "hugin.company-application.receipt.v1";

/** A saved, unsent application. It belongs to one semester and carries its one-time id. */
const storedDraftSchema = z.object({
	semesterId: z.string(),
	submissionId: z.string(),
	values: applicationDraftSchema,
});

export type StoredDraft = z.infer<typeof storedDraftSchema>;

const { shape } = applicationFormSchema;

/**
 * What the receipt page shows, since the submit action returns nothing: the answers in the
 * summary and nothing else, so no contact details are kept.
 */
const storedReceiptSchema = z.object({
	applicationDeadline: z.string(),
	late: z.boolean(),
	company: z.object({ name: z.string(), orgNumber: z.string() }),
	eventType: shape.eventType,
	minStudents: shape.minStudents,
	maxStudents: shape.maxStudents,
	availableDates: z.array(z.string()),
	venue: shape.venue,
	wantsToUseEscape: shape.wantsToUseEscape,
	billing: z.object({ email: z.string().optional(), details: z.string().optional() }),
});

export type StoredReceipt = z.infer<typeof storedReceiptSchema>;

/** A new one-time id for a draft, so a retried submit saves one application. */
export function newSubmissionId(): string {
	return crypto.randomUUID();
}

function readJson(storage: () => Storage, key: string): unknown {
	try {
		const raw = storage().getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function writeJson(storage: () => Storage, key: string, value: unknown): void {
	try {
		storage().setItem(key, JSON.stringify(value));
	} catch {
		// Storage is full or blocked; the form still works, it just is not saved.
	}
}

function remove(storage: () => Storage, key: string): void {
	try {
		storage().removeItem(key);
	} catch {
		// Nothing to clear when storage is blocked.
	}
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** The saved draft for this semester. Unreadable answers come back unanswered. */
export function loadDraft(semesterId: string): StoredDraft | null {
	const stored = storedDraftSchema.safeParse(readJson(local, DRAFT_KEY));
	return stored.success && stored.data.semesterId === semesterId ? stored.data : null;
}

export function saveDraft(draft: StoredDraft): void {
	writeJson(local, DRAFT_KEY, draft);
}

export function clearDraft(): void {
	remove(local, DRAFT_KEY);
}

/** The receipt for a sent application. */
export function receiptOf({
	form,
	company,
	applicationDeadline,
	late,
}: {
	form: ApplicationForm;
	company: ChosenCompany;
	applicationDeadline: string;
	late: boolean;
}): StoredReceipt {
	return {
		applicationDeadline,
		late,
		company: { name: company.name, orgNumber: company.orgNumber },
		eventType: form.eventType,
		minStudents: form.minStudents,
		maxStudents: form.maxStudents,
		availableDates: form.availableDates,
		venue: form.venue,
		wantsToUseEscape: form.wantsToUseEscape,
		billing: form.billing,
	};
}

export function saveReceipt(receipt: StoredReceipt): void {
	writeJson(session, RECEIPT_KEY, receipt);
}

export function loadReceipt(): StoredReceipt | null {
	const stored = storedReceiptSchema.safeParse(readJson(session, RECEIPT_KEY));
	return stored.success ? stored.data : null;
}
