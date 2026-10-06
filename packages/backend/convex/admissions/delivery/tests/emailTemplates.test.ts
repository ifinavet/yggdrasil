import { render } from "@react-email/render";
import AdmissionsInterviewEmail from "@workspace/emails/admissions-interview-email";
import { expect, it } from "vitest";

it.each([false, true])(
	"renders room directions and a link to the applicant's interview (reminder: %s)",
	async (reminder) => {
		const html = await render(
			AdmissionsInterviewEmail({
				reminder,
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
