import { render } from "@react-email/render";
import AdmissionsCancellationEmail from "@workspace/emails/admissions-cancellation-email";
import AdmissionsInterviewEmail from "@workspace/emails/admissions-interview-email";
import AdmissionsOfferEmail from "@workspace/emails/admissions-offer-email";
import AdmissionsRejectionEmail from "@workspace/emails/admissions-rejection-email";
import { expect, it } from "vitest";

const applicationUrl = "https://hugin.example.test/admissions";
const interview = {
	firstName: "Kari",
	periodTitle: "Høstopptak",
	when: "12. oktober kl. 10:00",
	room: "Beta",
	applicationUrl,
};

it.each([
	["interview", AdmissionsInterviewEmail(interview)],
	["reminder", AdmissionsInterviewEmail({ ...interview, reminder: true })],
	[
		"offer",
		AdmissionsOfferEmail({
			firstName: "Kari",
			periodTitle: "Høstopptak",
			group: "Data",
			responseUrl: applicationUrl,
		}),
	],
	[
		"cancellation",
		AdmissionsCancellationEmail({
			firstName: "Kari",
			periodTitle: "Høstopptak",
			when: "12. oktober kl. 10:00",
		}),
	],
	["rejection", AdmissionsRejectionEmail({ firstName: "Kari", periodTitle: "Høstopptak" })],
])("keeps the %s email copy in the single-service voice", async (_name, email) => {
	const html = await render(email);
	const plainText = await render(email, { plainText: true });
	const visibleText = plainText.replace(/https?:\/\/\S+/g, "");

	expect(html).not.toMatch(/Logg inn på Hugin|Hugin-konto/i);
	expect(visibleText).not.toMatch(/Hugin|logg inn|logg på/i);
});
