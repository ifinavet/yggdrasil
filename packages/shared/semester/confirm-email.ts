// The email a company gets after sending the bedpres form, with the link that confirms the
// application. Editors can write their own subject and text per semester in Bifrost; an empty one
// uses these defaults. The confirm button and the line with the link are always added below.

/** Where the company's name goes in the subject and text. */
export const CONFIRM_EMAIL_COMPANY = "{bedrift}";

export const CONFIRM_EMAIL_LIMITS = { subject: 150, text: 3000 } as const;

export const CONFIRM_EMAIL_DEFAULTS = {
	subject: "Bekreft søknaden deres om bedriftsarrangement",
	text: [
		"Hei,",
		`Så hyggelig at ${CONFIRM_EMAIL_COMPANY} vil holde et arrangement for studentene våre! Trykk på knappen under for å bekrefte søknaden, så får vi den.`,
		"Har dere ikke søkt, kan dere bare se bort fra denne e-posten. Lurer dere på noe, svarer vi gjerne. Bare svar på denne e-posten.",
	].join("\n\n"),
} as const;

export type ConfirmEmailText = Readonly<{
	confirmEmailSubject?: string;
	confirmEmailText?: string;
}>;

/** The subject and paragraphs one company gets, from the semester's own text or the default. */
export function confirmEmailFor(
	semester: ConfirmEmailText | null | undefined,
	companyName: string,
): { subject: string; paragraphs: string[] } {
	const fill = (template: string) => template.replaceAll(CONFIRM_EMAIL_COMPANY, companyName);
	const subject = fill(semester?.confirmEmailSubject?.trim() || CONFIRM_EMAIL_DEFAULTS.subject);
	const text = fill(semester?.confirmEmailText?.trim() || CONFIRM_EMAIL_DEFAULTS.text);
	return {
		subject: subject.replaceAll(/\s+/g, " "),
		paragraphs: text
			.split(/\n\s*\n/)
			.map((paragraph) => paragraph.trim())
			.filter(Boolean),
	};
}
