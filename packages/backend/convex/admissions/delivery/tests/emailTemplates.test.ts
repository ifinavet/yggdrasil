import { render } from "@react-email/render";
import AdmissionsInterviewEmail from "@workspace/emails/admissions-interview-email";
import AdmissionsReminderEmail from "@workspace/emails/admissions-reminder-email";
import { expect, it } from "vitest";

it.each([AdmissionsInterviewEmail, AdmissionsReminderEmail])(
	"renders room directions and a link to the applicant's interview in %s",
	async (template) => {
		const html = await render(
			template({
				firstName: "Kari",
				periodTitle: "Høstopptak",
				when: "12. oktober kl. 10:00",
				room: " Store Beta ",
				applicationUrl: "https://hugin.example.test/admissions",
			}),
		);
		expect(html).toContain('href="https://ifirom.no/store%20beta"');
		expect(html).toContain('href="https://hugin.example.test/admissions"');
		expect(html).toContain("Se eller avlys intervjuet");
		expect(html).toContain("12. oktober kl. 10:00");
	},
);
