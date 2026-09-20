import { eventResponseFromSchema } from "@/lib/schema/event-feedback-schema";

export interface RatingQuestion {
	id: "satisfaction" | "impression" | "expectation";
	label: string;
	low: string;
	high: string;
}

export interface TextQuestion {
	id: "toughts" | "improvements" | "other";
	label: string;
	placeholder: string;
	optional?: boolean;
}

export const ratingQuestions = [
	{
		id: "satisfaction",
		label: "Hvordan syntes du arrangementet var?",
		low: "Veldig dårlig",
		high: "Veldig bra",
	},
	{
		id: "impression",
		label: "Hvilket inntrykk fikk du av bedriften?",
		low: "Veldig dårlig",
		high: "Veldig bra",
	},
	{
		id: "expectation",
		label: "Var arrangementet som forventet?",
		low: "Dårligere enn forventet",
		high: "Bedre enn forventet",
	},
] as const satisfies readonly RatingQuestion[];

export const toughtsQuestion = {
	id: "toughts",
	label: "Hva syntes du om arrangementet og bedriften?",
	placeholder: "F.eks. «Godt lagt opp, men litt knapp tid til spørsmål»",
	optional: false,
} as const satisfies TextQuestion;

export const improvementsQuestion = {
	id: "improvements",
	label: "Hva kunne gjort arrangementet bedre?",
	placeholder: "F.eks. «Mer tid til mingling etterpå»",
	optional: false,
} as const satisfies TextQuestion;

export const otherQuestion = {
	id: "other",
	label: "Noe annet du vil si?",
	placeholder: "",
	optional: true,
} as const satisfies TextQuestion;

export const textQuestions = [
	toughtsQuestion,
	improvementsQuestion,
	otherQuestion,
] as const satisfies readonly TextQuestion[];

export const yesNoQuestion = {
	id: "want_to_work",
	label: "Kunne du tenkt deg å jobbe for denne bedriften?",
} as const;

export const optionsQuestion = {
	id: "word_of_mouth",
	label: "Hvordan fikk du vite om arrangementet?",
	options: [
		"Ifinavet.no",
		"Stand utenfor Simula",
		"Facebook (IFI-studenter)",
		"Facebook (Arrangementside)",
		"Instagram",
		"Venner",
	],
} as const;

export const requiredFieldNames = [
	...ratingQuestions.map((question) => question.id),
	...textQuestions.filter((question) => !question.optional).map((question) => question.id),
	yesNoQuestion.id,
	optionsQuestion.id,
] as const;

export const requiredQuestionCount = requiredFieldNames.length;

export type FeedbackQuestion =
	| { kind: "rating"; question: (typeof ratingQuestions)[number] }
	| { kind: "text"; question: TextQuestion }
	| { kind: "yesNo"; question: typeof yesNoQuestion }
	| { kind: "options"; question: typeof optionsQuestion };

/**
 * The order the student reads, and therefore the number each question carries.
 * The optional question is last, so the numbers count what is on screen.
 */
export const questionOrder: readonly FeedbackQuestion[] = [
	...ratingQuestions.map((question) => ({ kind: "rating" as const, question })),
	{ kind: "text", question: toughtsQuestion },
	{ kind: "text", question: improvementsQuestion },
	{ kind: "yesNo", question: yesNoQuestion },
	{ kind: "options", question: optionsQuestion },
	{ kind: "text", question: otherQuestion },
];

/** Every question on screen, optional ones included. */
export const questionCount = questionOrder.length;

const NUMBER_WORDS = [
	"null",
	"én",
	"to",
	"tre",
	"fire",
	"fem",
	"seks",
	"sju",
	"åtte",
	"ni",
	"ti",
	"elleve",
	"tolv",
];

const countWord = NUMBER_WORDS[questionCount] ?? String(questionCount);

/** The question count spelled out, for the intro sentence ("Åtte kjappe spørsmål"). */
export const questionCountWord = countWord.charAt(0).toUpperCase() + countWord.slice(1);

/**
 * Required questions whose answer is still missing or invalid, in question order.
 *
 * The rules come from the same schema that guards submission, so the progress
 * counter and the send button can never disagree with the validator.
 */
export function missingRequiredFields(values: unknown): string[] {
	const result = eventResponseFromSchema.safeParse(values);
	if (result.success) return [];

	const invalid = new Set(result.error.issues.map((issue) => String(issue.path[0])));

	return requiredFieldNames.filter((field) => invalid.has(field));
}
