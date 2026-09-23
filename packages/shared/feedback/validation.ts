import { z } from "zod";

const fieldKeyMessage = "Spørsmålene må ha forskjellige, gyldige feltnavn.";
const optionsMessage =
	"Flervalgsspørsmål må ha 1 til 30 forskjellige, utfylte alternativer på maks 200 tegn.";
const hint = z.string().max(500, "Hjelpetekster kan ha maks 500 tegn.").optional();
const options = z
	.array(z.string().max(200, optionsMessage).regex(/\S/, optionsMessage), { error: optionsMessage })
	.min(1, optionsMessage)
	.max(30, optionsMessage)
	.refine((values) => new Set(values).size === values.length, optionsMessage);

export const feedbackFieldSchema = z
	.object({
		key: z
			.string()
			.regex(/^[a-z][a-z0-9_]{0,63}$/, fieldKeyMessage)
			.refine((key) => !["constructor", "prototype"].includes(key), fieldKeyMessage),
		type: z.enum(["rating", "text", "yesNo", "options"]),
		label: z
			.string()
			.max(500, "Skriv en spørsmålstekst på maks 500 tegn.")
			.regex(/\S/, "Skriv en spørsmålstekst på maks 500 tegn."),
		required: z.boolean(),
		options: options.optional(),
		allowOther: z.boolean().optional(),
		low: hint,
		high: hint,
		placeholder: hint,
	})
	.refine((field) => field.type !== "options" || field.options !== undefined, {
		message: optionsMessage,
		path: ["options"],
	});

export const feedbackFieldsSchema = z
	.array(feedbackFieldSchema)
	.min(1, "Skjemaet må ha mellom 1 og 40 spørsmål.")
	.max(40, "Skjemaet må ha mellom 1 og 40 spørsmål.")
	.refine(
		(fields) => new Set(fields.map((field) => field.key)).size === fields.length,
		fieldKeyMessage,
	);

export const feedbackFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Skriv et navn på skjemaet.")
		.max(200, "Skjemanavnet kan ha maks 200 tegn."),
	fields: feedbackFieldsSchema,
});

export type FeedbackField = z.infer<typeof feedbackFieldSchema>;
export type FeedbackAnswers = Record<string, string | number | string[]>;

export const feedbackRatingSchema = z
	.number({ error: "Velg en verdi fra 1 til 5" })
	.int("Velg en verdi fra 1 til 5")
	.min(1, "Velg en verdi fra 1 til 5")
	.max(5, "Velg en verdi fra 1 til 5");
export const feedbackTextSchema = z
	.string({ error: "Skriv et svar på maks 1000 tegn" })
	.max(1000, "Skriv et svar på maks 1000 tegn")
	.regex(/\S/, "Skriv et svar på maks 1000 tegn");
export const feedbackYesNoSchema = z.enum(["ja", "nei"], { error: "Velg ja eller nei" });

export function feedbackOptionsSchema(choices: readonly string[], allowOther = false) {
	const message = "Velg gyldige alternativer";
	return z
		.array(z.string({ error: message }).max(1000, message).regex(/\S/, message), { error: message })
		.min(1, "Fyll inn et svar")
		.max(choices.length + (allowOther ? 1 : 0), message)
		.refine((values) => new Set(values).size === values.length, message)
		.refine(
			(values) => values.filter((value) => !choices.includes(value)).length <= (allowOther ? 1 : 0),
			message,
		);
}

/** A Standard Schema validator, accepted directly by TanStack React Form. */
export function feedbackAnswersSchema(fields: FeedbackField[]) {
	const shape: Record<string, z.ZodType> = {};
	for (const field of fields) {
		const schema = {
			rating: feedbackRatingSchema,
			text: feedbackTextSchema,
			yesNo: feedbackYesNoSchema,
			options: feedbackOptionsSchema(field.options ?? [], field.allowOther),
		}[field.type];
		shape[field.key] = z.preprocess(
			(value) => (value === "" || (Array.isArray(value) && value.length === 0) ? undefined : value),
			field.required
				? z
						.unknown()
						.refine((value) => value !== undefined, "Fyll inn et svar")
						.pipe(schema)
				: schema.optional(),
		);
	}
	return z.preprocess(
		// Only submitted own properties are answers; inherited properties are omitted.
		(data) =>
			data !== null && typeof data === "object" && !Array.isArray(data)
				? Object.assign(Object.create(null), data)
				: data,
		z.strictObject(shape, { error: "Svaret inneholder ukjente felt." }),
	);
}

export function validateFeedbackFields(fields: unknown): string | null {
	const result = feedbackFieldsSchema.safeParse(fields);
	return result.success ? null : (result.error.issues[0]?.message ?? "Ugyldig skjema.");
}

/** Maps Zod issues to the existing field-error contract for mutation callers. */
export function feedbackErrors(fields: FeedbackField[], data: unknown): Record<string, string> {
	const result = feedbackAnswersSchema(fields).safeParse(data);
	if (result.success) return {};
	const errors: Record<string, string> = {};
	for (const issue of result.error.issues) {
		const key = String(issue.path[0] ?? "_form");
		errors[key] ??= issue.message;
	}
	return errors;
}
