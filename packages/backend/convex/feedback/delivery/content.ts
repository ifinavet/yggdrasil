"use node";

import { render } from "@react-email/render";
import FeedbackEmail from "@workspace/emails/feedback-email";
import FeedbackReportEmail from "@workspace/emails/feedback-report-email";
import { HUGIN_URL } from "@workspace/shared/constants";
import { formatFeedbackDate } from "@workspace/shared/feedback/time";
import type { Infer } from "convex/values";
import { isLocalDevelopment } from "../../auth/local";
import { generateLinkToken } from "../../lib/tokens";
import { reportEmailSubject } from "../reports/messages";
import type { deliveryArgs } from "./messages";

type FeedbackRound = Infer<typeof deliveryArgs.round>;

function huginOrigin() {
	return new URL(isLocalDevelopment() ? "http://localhost:3003" : HUGIN_URL);
}

function linkWithTokenOutsideHttpRequests(origin: URL, path: string) {
	const token = generateLinkToken();
	const url = new URL(path, origin);
	url.hash = new URLSearchParams({ token }).toString();
	return { token, url: url.toString() };
}

export async function feedbackEmailContent(title: string, round: FeedbackRound) {
	const { token, url } = linkWithTokenOutsideHttpRequests(huginOrigin(), "/feedback");
	const reminder = round !== 0;
	return {
		token,
		url,
		subject: `${reminder ? "Påminnelse" : "Tilbakemelding"}: ${title}`,
		html: await render(FeedbackEmail({ event: title, url, reminder })),
	};
}

export async function reportEmailContent(eventTitle: string, eventStart: number) {
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
				logoUrl: new URL("/report-navet.webp", origin).toString(),
			}),
		),
	};
}
