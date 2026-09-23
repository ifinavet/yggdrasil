/** The serializable contract shared by the feedback renderer and its backend. */
export type FeedbackField = {
	key: string;
	type: "rating" | "text" | "yesNo" | "options";
	label: string;
	required: boolean;
	options?: string[];
	allowOther?: boolean;
	low?: string;
	high?: string;
	placeholder?: string;
};

export type FeedbackAnswers = Record<string, string | number | string[]>;

export function validateFeedbackFields(fields: FeedbackField[]): string | null {
	if (fields.length === 0 || fields.length > 40) return "Skjemaet må ha mellom 1 og 40 spørsmål.";
	const keys = new Set<string>();
	for (const field of fields) {
		if (
			!/^[a-z][a-z0-9_]{0,63}$/.test(field.key) ||
			["constructor", "prototype"].includes(field.key) ||
			keys.has(field.key)
		)
			return "Spørsmålene må ha forskjellige, gyldige feltnavn.";
		keys.add(field.key);
		if (!field.label.trim() || field.label.length > 500)
			return "Skriv en spørsmålstekst på maks 500 tegn.";
		if (
			[field.low, field.high, field.placeholder].some(
				(text) => text !== undefined && text.length > 500,
			)
		) {
			return "Hjelpetekster kan ha maks 500 tegn.";
		}
		if (field.type === "options") {
			const options = field.options;
			if (
				!options ||
				options.length === 0 ||
				options.length > 30 ||
				new Set(options).size !== options.length ||
				options.some((option) => !option.trim() || option.length > 200)
			) {
				return "Flervalgsspørsmål må ha 1 til 30 forskjellige, utfylte alternativer på maks 200 tegn.";
			}
		}
	}
	return null;
}

/** Both clients and mutations use these rules; only the mutation can accept an answer. */
export function feedbackErrors(
	fields: FeedbackField[],
	data: FeedbackAnswers,
): Record<string, string> {
	const errors: Record<string, string> = {};
	const keys = new Set(fields.map((field) => field.key));
	if (Object.keys(data).some((key) => !keys.has(key)))
		errors._form = "Svaret inneholder ukjente felt.";
	for (const field of fields) {
		const value = data[field.key];
		const empty =
			value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
		if (empty) {
			if (field.required) errors[field.key] = "Fyll inn et svar";
			continue;
		}
		switch (field.type) {
			case "rating":
				if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
					errors[field.key] = "Velg en verdi fra 1 til 5";
				}
				break;
			case "text":
				if (typeof value !== "string" || !value.trim() || value.length > 1000) {
					errors[field.key] = "Skriv et svar på maks 1000 tegn";
				}
				break;
			case "yesNo":
				if (value !== "ja" && value !== "nei") errors[field.key] = "Velg ja eller nei";
				break;
			case "options": {
				const options = field.options ?? [];
				if (
					!Array.isArray(value) ||
					value.length > options.length + (field.allowOther ? 1 : 0) ||
					new Set(value).size !== value.length ||
					value.some((choice) => !choice.trim() || choice.length > 1000) ||
					value.filter((choice) => !options.includes(choice)).length > (field.allowOther ? 1 : 0)
				) {
					errors[field.key] = "Velg gyldige alternativer";
				}
				break;
			}
		}
	}
	return errors;
}

export function emptyFeedbackAnswers(fields: FeedbackField[]): FeedbackAnswers {
	return Object.fromEntries(fields.map((field) => [field.key, field.type === "options" ? [] : ""]));
}

/** Untrusted email query parameters only select a rating; they never submit it. */
export function feedbackPrefill(
	fields: FeedbackField[],
	key?: string,
	answer?: string,
): FeedbackAnswers {
	const values = emptyFeedbackAnswers(fields);
	const field = fields.find((item) => item.key === key && item.type === "rating");
	if (field && answer && /^[1-5]$/.test(answer)) values[field.key] = Number(answer);
	return values;
}
