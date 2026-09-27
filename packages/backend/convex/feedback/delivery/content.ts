"use node";

import { render } from "@react-email/render";
import FeedbackEmail from "@workspace/emails/feedback-email";
import FeedbackReportEmail from "@workspace/emails/feedback-report-email";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { formatOsloDate } from "@workspace/shared/time";
import type { Infer } from "convex/values";
import { isLocalDevelopment } from "../../auth/local";
import { generateLinkToken } from "../../lib/tokens";
import { reportEmailSubject } from "../reports/messages";
import type { FeedbackEmailContext } from "./emailContext";
import { deliveryArgs } from "./messages";

type FeedbackRound = Infer<typeof deliveryArgs.round>;

function huginOrigin() {
	return new URL(isLocalDevelopment() ? HUGIN_LOCAL_URL : HUGIN_URL);
}

function linkWithTokenOutsideHttpRequests(origin: URL, path: string) {
	const token = generateLinkToken();
	const url = new URL(path, origin);
	url.hash = new URLSearchParams({ token }).toString();
	return { token, url: url.toString() };
}

function feedbackSubjectPrefix(round: FeedbackRound, firstName: string) {
	const rounds = deliveryArgs.round.members;
	const index = rounds.findIndex(({ value }) => value === round);
	if (index === 0) return "Tilbakemelding";
	if (index === rounds.length - 1)
		return firstName ? `Siste påminnelse, ${firstName}` : "Siste påminnelse";
	return firstName
		? `${firstName}, vi mangler tilbakemeldingen din`
		: "Vi mangler tilbakemeldingen din";
}

export async function feedbackEmailContent(
	{ title, firstName, companyName, signature }: FeedbackEmailContext,
	round: FeedbackRound,
) {
	const { token, url } = linkWithTokenOutsideHttpRequests(huginOrigin(), "/feedback");
	const reminder = round !== deliveryArgs.round.members[0].value;
	return {
		token,
		url,
		subject: `${feedbackSubjectPrefix(round, firstName)}: ${title}`,
		html: await render(FeedbackEmail({ firstName, companyName, signature, url, reminder })),
	};
}

export async function reportEmailContent({
	eventTitle,
	eventStart,
	signature,
}: Readonly<{
	eventTitle: string;
	eventStart: number;
	signature: FeedbackEmailContext["signature"];
}>) {
	const origin = huginOrigin();
	const { token, url } = linkWithTokenOutsideHttpRequests(origin, "/report");
	return {
		token,
		url,
		subject: reportEmailSubject(eventTitle),
		html: await render(
			FeedbackReportEmail({
				eventDate: formatOsloDate(eventStart, "d. MMMM"),
				url,
				signature,
			}),
		),
	};
}
