import { describe, expect, it } from "vitest";
import { offerEmail, offerUrl } from "./offer-link";

describe("offerEmail", () => {
	it("greets the contact by first name and gives the day and the link", () => {
		const url = offerUrl("abc123");
		const email = offerEmail({
			to: "kari@fjordkode.no",
			contactName: "Kari Nordmann",
			date: "2027-02-09",
			url,
		});

		expect(url).toMatch(/\/bestill-bedpres\/tilbud\/abc123$/);
		expect(email.to).toBe("kari@fjordkode.no");
		expect(email.subject).toBe("Tilbud om bedriftsarrangement tirsdag 9. februar 2027");
		expect(email.body).toMatch(/^Hei Kari,/);
		expect(email.body).toContain(url);
		expect(email.body).not.toContain("—");
	});
});
