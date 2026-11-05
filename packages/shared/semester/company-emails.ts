// The emails a company gets about its bedpres application. Editors can write their own subject
// and text for each per semester in Bifrost; an empty one uses the default here. The button and the
// lines around it are always added below the text, so they cannot be removed by mistake.

/** Where the company's name goes in the subject and text. */
export const EMAIL_COMPANY = "{bedrift}";
/** Where the contact person's first name goes. */
export const EMAIL_FIRST_NAME = "{navn}";
/** Where the offered day goes, e.g. «tirsdag 9. februar 2027». */
export const EMAIL_DATE = "{dato}";

export const COMPANY_EMAIL_LIMITS = { subject: 150, text: 3000 } as const;

/** The company, contact and day the previews in Bifrost are written for. */
export const EMAIL_PREVIEW = {
	companyName: "FJORDKODE AS",
	firstName: "Kari",
	day: "tirsdag 9. februar 2027",
} as const;

export type EmailTemplate = Readonly<{ subject: string; text: string }>;
type EmailContent = { subject: string; paragraphs: string[] };

/** The email with the link that confirms an application, sent after the bedpres form. */
export const CONFIRM_EMAIL_DEFAULTS: EmailTemplate = {
	subject: "Bekreft søknaden deres om bedriftsarrangement",
	text: [
		"Hei,",
		`Så hyggelig at ${EMAIL_COMPANY} vil holde et arrangement for studentene våre! Trykk på knappen under for å bekrefte søknaden, så får vi den.`,
		"Har dere ikke søkt, kan dere bare se bort fra denne e-posten. Lurer dere på noe, svarer vi gjerne. Bare svar på denne e-posten.",
	].join("\n\n"),
};

/** The email with the link to the offered date. */
export const OFFER_EMAIL_DEFAULTS: EmailTemplate = {
	subject: `Tilbud om bedriftsarrangement ${EMAIL_DATE}`,
	text: [
		`Hei ${EMAIL_FIRST_NAME},`,
		`Takk for søknaden om bedriftsarrangement hos Navet. Vi kan tilby dere ${EMAIL_DATE}.`,
	].join("\n\n"),
};

type CompanyEmailTexts = Readonly<{
	confirmEmailSubject?: string;
	confirmEmailText?: string;
	offerEmailSubject?: string;
	offerEmailText?: string;
}>;

/**
 * Fills in an editor's subject and text, or the default where one is empty, and splits the text
 * into paragraphs at blank lines.
 */
function fillEmail(
	own: Partial<EmailTemplate>,
	defaults: EmailTemplate,
	values: Readonly<Record<string, string>>,
): EmailContent {
	const fill = (template: string) =>
		Object.entries(values).reduce((text, [key, value]) => text.replaceAll(key, value), template);
	const subject = fill(own.subject?.trim() || defaults.subject);
	const text = fill(own.text?.trim() || defaults.text);
	return {
		subject: subject.replaceAll(/\s+/g, " "),
		paragraphs: text
			.split(/\n\s*\n/)
			.map((paragraph) => paragraph.trim())
			.filter(Boolean),
	};
}

/** The confirm email one company gets, from the semester's own text or the default. */
export function confirmEmailFor(
	semester: CompanyEmailTexts | null | undefined,
	companyName: string,
): EmailContent {
	return fillEmail(
		{ subject: semester?.confirmEmailSubject, text: semester?.confirmEmailText },
		CONFIRM_EMAIL_DEFAULTS,
		{ [EMAIL_COMPANY]: companyName },
	);
}

/** The offer email one company gets, from the semester's own text or the default. */
export function offerEmailFor(
	semester: CompanyEmailTexts | null | undefined,
	values: Readonly<{ companyName: string; firstName: string; day: string }>,
): EmailContent {
	return fillEmail(
		{ subject: semester?.offerEmailSubject, text: semester?.offerEmailText },
		OFFER_EMAIL_DEFAULTS,
		{
			[EMAIL_COMPANY]: values.companyName,
			[EMAIL_FIRST_NAME]: values.firstName,
			[EMAIL_DATE]: values.day,
		},
	);
}
