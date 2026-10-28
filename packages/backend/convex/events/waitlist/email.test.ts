import { render } from "@react-email/render";
import AvailableSeatEmail from "@workspace/emails/available-seat-email";
import { describe, expect, it } from "vitest";

describe("available seat email", () => {
	const url = "https://ifinavet.no/events/event/registration/registration";
	it("renders separate yes/no HTML buttons with explicit choices and a fallback link", async () => {
		const html = await render(AvailableSeatEmail({ event: "Bedpres", url }));
		expect(html).toContain(`href="${url}?response=accept"`);
		expect(html).toContain(`href="${url}?response=decline"`);
		expect(html).toContain("Ja, jeg vil ha plassen");
		expect(html).toContain("Nei, gi plassen videre");
		expect(html).toContain(`href="${url}"`);
		expect(html).toContain("bekreft på nettsiden");
	});
	it("keeps both choices and URLs in plain text", async () => {
		const text = await render(AvailableSeatEmail({ event: "Bedpres", url }), { plainText: true });
		expect(text).toContain(`${url}?response=accept`);
		expect(text).toContain(`${url}?response=decline`);
	});
});
