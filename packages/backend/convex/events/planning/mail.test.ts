// @vitest-environment node
import { render } from "@react-email/render";
import EventPlanningEmail from "@workspace/emails/event-planning-email";
import { expect, it } from "vitest";

it("places the planning link before the organizer signature", async () => {
	const html = await render(
		EventPlanningEmail({
			subject: "Planlegg bedriftspresentasjon",
			text: "Hei!\n\nFyll inn skjemaet.\n\nMed vennlig hilsen\nArrangør",
			url: "https://example.test/event-planning",
			confirmation: false,
		}),
	);
	expect(html.indexOf("Fyll inn skjemaet.")).toBeLessThan(
		html.indexOf('href="https://example.test/event-planning"'),
	);
	expect(html.indexOf('href="https://example.test/event-planning"')).toBeLessThan(
		html.indexOf("Med vennlig hilsen"),
	);
	expect(html).toContain("Arrangør");
});
