"use node";

import { render } from "@react-email/render";
import FeedbackEmail from "@workspace/emails/feedback-email";
import FeedbackReportEmail from "@workspace/emails/feedback-report-email";
import { HUGIN_LOCAL_URL, HUGIN_URL } from "@workspace/shared/constants";
import { formatFeedbackDate } from "@workspace/shared/feedback/time";
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

export async function feedbackEmailContent(
	{ title, companyName, signature }: FeedbackEmailContext,
	round: FeedbackRound,
) {
	const { token, url } = linkWithTokenOutsideHttpRequests(huginOrigin(), "/feedback");
	const reminderNumber = deliveryArgs.round.members.findIndex(({ value }) => value === round);
	const reminder = reminderNumber > 0;
	const subjectPrefix = reminder ? `${reminderNumber}. påminnelse` : "Tilbakemelding";
	return {
		token,
		url,
		subject: `${subjectPrefix}: ${title}`,
		html: await render(FeedbackEmail({ companyName, signature, url, reminder })),
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
				eventDate: formatFeedbackDate(eventStart, "d. MMMM"),
				url,
				signature,
			}),
		),
	};
}
