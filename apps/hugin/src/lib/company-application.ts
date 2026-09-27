import type { api } from "@workspace/backend/convex/api";
import { applicationFormSchema, STUDENT_CAP } from "@workspace/shared/semester/application";
import {
	ESCAPE_ANSWERS,
	EVENT_TYPE_LABELS,
	EVENT_TYPES,
	FOOD_PURCHASERS,
	VENUES,
} from "@workspace/shared/semester/labels";
import type { FunctionReturnType } from "convex/server";
import { z } from "zod";
import { COMPANY_APPLICATION_COPY } from "./company-application-questions";

// State and validation for the Hugin application form (/bestill-bedpres). The form keeps loose
// values while the company types; the shared schema decides what is valid.

/** One company from the Enhetsregisteret search. */
export type RegistryHit = FunctionReturnType<
	typeof api.semesterPlanning.registry.actions.searchCompanies
>[number];

export type BlockedReason = NonNullable<RegistryHit["blockedReason"]>;

const ORG_NUMBER = /^\d{9}$/;

/** A company picked from Enhetsregisteret, as the search returned it. */
const chosenCompanySchema = z.object({
	orgNumber: z.string().regex(ORG_NUMBER),
	name: z.string(),
	organizationForm: z.string(),
	city: z.string().optional(),
});

export type ChosenCompany = z.infer<typeof chosenCompanySchema>;

const answer = z.string().catch("");

/** A choice among `options`, or "" while it is not answered. */
function choice<const T extends readonly [string, ...string[]]>(options: T) {
	return z.union([z.enum(options), z.literal("")]).catch("");
}

/**
 * What the form holds while it is filled in. Empty strings and null mean «not answered». Parsing
 * never fails on a single answer: anything unreadable, as in a draft saved by an older version of
 * the page, falls back to «not answered».
 */
export const applicationDraftSchema = z.object({
	company: chosenCompanySchema.nullable().catch(null),
	contact: z
		.object({ name: answer, email: answer, phone: answer })
		.catch(() => ({ name: "", email: "", phone: "" })),
	eventType: choice(EVENT_TYPES),
	/** The number of students as the company writes it: «30», or a range like «20–40». */
	students: answer,
	description: answer,
	availableDates: z.array(z.string()).catch([]),
	datePreferences: answer,
	venue: choice(VENUES),
	foodAndDrinks: z.boolean().nullable().catch(null),
	foodPurchasedBy: choice(FOOD_PURCHASERS),
	wantsToUseEscape: choice(ESCAPE_ANSWERS),
	billing: z
		.object({ email: answer, details: answer, ehfInvoice: z.boolean().catch(false) })
		.catch(() => ({ email: "", details: "", ehfInvoice: false })),
	additionalInfo: answer,
	consent: z.boolean().catch(false),
});

export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;
export type DraftField = keyof ApplicationDraft;

export function emptyDraft(): ApplicationDraft {
	return applicationDraftSchema.parse({});
}

/** The questions on the page, in order, named after the form field each one asks for. */
export const QUESTION_KEYS = [
	"company",
	"contact",
	"eventType",
	"students",
	"description",
	"availableDates",
	"datePreferences",
	"venue",
	"foodAndDrinks",
	"wantsToUseEscape",
	"billing",
	"additionalInfo",
	"consent",
] as const satisfies readonly DraftField[];
export type QuestionKey = (typeof QUESTION_KEYS)[number];

const OPTIONAL_QUESTIONS = new Set<QuestionKey>(["datePreferences", "additionalInfo"]);

export const REQUIRED_QUESTIONS = QUESTION_KEYS.filter((key) => !OPTIONAL_QUESTIONS.has(key));

export function isOptionalQuestion(key: QuestionKey): boolean {
	return OPTIONAL_QUESTIONS.has(key);
}

/** The question number shown on the page: «1. Hvilken bedrift gjelder det?». */
export function questionNumber(key: QuestionKey): number {
	return QUESTION_KEYS.indexOf(key) + 1;
}

/** Questions that ask for more than their own field: who buys the food is part of the food question. */
const QUESTION_FIELDS: Partial<Record<QuestionKey, DraftField[]>> = {
	foodAndDrinks: ["foodAndDrinks", "foodPurchasedBy"],
};

const STUDENT_COUNT = /^(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?$/;

/**
 * Reads the number of students from what the company wrote: «30» is 30 to 30, and «20–40» or
 * «20-40» is 20 to 40. Anything else is null, and so is an empty answer.
 */
export function parseStudentCount(value: string): { min: number; max: number } | null {
	const match = STUDENT_COUNT.exec(value.trim());
	if (!match?.[1]) return null;
	const min = Number(match[1]);
	return { min, max: match[2] ? Number(match[2]) : min };
}

function optional(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

function answered<T extends string>(value: T | ""): T | undefined {
	return value === "" ? undefined : value;
}

/** The submission with every key the backend takes; the shared schema checks the values. */
export type SubmissionCandidate = { [K in keyof z.input<typeof applicationFormSchema>]: unknown };

/** The draft in the shape the backend takes, before the shared schema checks it. */
export function toSubmission(draft: ApplicationDraft): SubmissionCandidate {
	const students = parseStudentCount(draft.students);
	return {
		orgNumber: draft.company?.orgNumber ?? "",
		contact: {
			name: draft.contact.name,
			email: draft.contact.email.trim(),
			phone: draft.contact.phone,
		},
		eventType: answered(draft.eventType),
		minStudents: students?.min,
		maxStudents: students?.max,
		description: draft.description,
		availableDates: draft.availableDates,
		datePreferences: optional(draft.datePreferences),
		venue: answered(draft.venue),
		wantsToUseEscape: answered(draft.wantsToUseEscape),
		foodAndDrinks: draft.foodAndDrinks ?? undefined,
		// Without food there is nothing to buy, so the question is hidden and left for later.
		foodPurchasedBy: draft.foodAndDrinks === false ? "undecided" : answered(draft.foodPurchasedBy),
		billing: {
			email: optional(draft.billing.email),
			details: optional(draft.billing.details),
			ehfInvoice: draft.billing.ehfInvoice,
		},
		// «Hvem vil dere nå?» is no longer asked.
		targetDegrees: [],
		targetStudyPrograms: [],
		additionalInfo: optional(draft.additionalInfo),
		consent: draft.consent,
	};
}

/** The draft as the application the backend takes: the same rules the server runs. */
export const applicationSubmissionSchema = applicationDraftSchema
	.transform(toSubmission)
	.pipe(applicationFormSchema);

function maxLengthOf(schema: { maxLength: number | null }): number {
	if (schema.maxLength === null) throw new Error("The shared schema sets no maximum length.");
	return schema.maxLength;
}

const { shape } = applicationFormSchema;

/** The longest text answers the shared schema takes, for the text boxes on the page. */
export const TEXT_LIMITS = {
	description: maxLengthOf(shape.description),
	datePreferences: maxLengthOf(shape.datePreferences.unwrap()),
	billingDetails: maxLengthOf(shape.billing.shape.details.unwrap()),
	additionalInfo: maxLengthOf(shape.additionalInfo.unwrap()),
};

/** The form field a submission issue belongs to, where the names differ. */
const FIELD_OF_SUBMISSION_KEY: Partial<Record<PropertyKey, DraftField>> = {
	orgNumber: "company",
	minStudents: "students",
	maxStudents: "students",
};

// The shared schema checks the student count against the event type, and that billing has an
// answer, only once every other answer is valid. The company should see them straight away, so
// they are checked here as well until the shared schema runs them on their own.

function studentCountIssue(draft: ApplicationDraft): string | undefined {
	if (draft.students.trim() === "") return undefined;
	const range = parseStudentCount(draft.students);
	if (!range) return COMPANY_APPLICATION_COPY.students.unreadable;
	const { min, max } = range;
	if (min > max) return "Minste antall kan ikke være større enn høyeste antall.";

	if (draft.eventType === "") return undefined;
	const cap = STUDENT_CAP[draft.eventType];
	if (cap !== null && max > cap) {
		return `${EVENT_TYPE_LABELS[draft.eventType]} har plass til ${cap}. Velg «Stor bedriftspresentasjon» for flere.`;
	}
	return undefined;
}

const MISSING_BILLING = "Skriv en e-post for faktura, eller hvordan dere vil ha fakturaen.";

/** The first message per form field, from the shared schema and the checks above. */
export type DraftErrors = Partial<Record<DraftField, string>>;

export function draftErrors(draft: ApplicationDraft): DraftErrors {
	const errors: DraftErrors = {};
	const result = applicationSubmissionSchema.safeParse(draft);

	if (!result.success) {
		for (const issue of result.error.issues) {
			const key = issue.path[0];
			if (key === undefined) continue;
			const field = FIELD_OF_SUBMISSION_KEY[key] ?? key;
			if (field in draft && errors[field as DraftField] === undefined) {
				errors[field as DraftField] = issue.message;
			}
		}
	}

	// The student count's own message is more precise than the schema's, so it wins.
	const studentIssue = studentCountIssue(draft);
	if (studentIssue) errors.students = studentIssue;
	if (!optional(draft.billing.email) && !optional(draft.billing.details)) {
		errors.billing ??= MISSING_BILLING;
	}

	return errors;
}

/** The message a question shows: the first among the fields it asks for. */
export function questionError(errors: DraftErrors, key: QuestionKey): string | undefined {
	return (QUESTION_FIELDS[key] ?? [key]).map((field) => errors[field]).find(Boolean);
}

/** The first question, in page order, that has a message. */
export function firstInvalidQuestion(errors: DraftErrors): QuestionKey | undefined {
	return QUESTION_KEYS.find((key) => questionError(errors, key) !== undefined);
}

/** How many required questions have a valid answer. */
export function answeredCount(errors: DraftErrors): number {
	return REQUIRED_QUESTIONS.filter((key) => questionError(errors, key) === undefined).length;
}

/**
 * The form-level validator: every message attached to its field, or nothing when the draft is
 * valid. TanStack Form shows each message on the field with the same name.
 */
export function validateApplicationDraft({ value }: { value: ApplicationDraft }) {
	const errors = draftErrors(value);
	return Object.keys(errors).length > 0 ? { fields: errors } : undefined;
}
