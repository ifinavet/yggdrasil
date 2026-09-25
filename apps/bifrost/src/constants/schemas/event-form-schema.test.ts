import { describe, expect, it } from "vitest";
import { eventFormSchema } from "./event-form-schema";

const values = {
	title: "Tittel",
	teaser: "En teaser",
	eventDate: new Date(),
	registrationDate: new Date(),
	description: "En beskrivelse",
	food: "Pizza",
	location: "Ole-Johan Dahls hus",
	ageRestrictions: "Ingen",
	language: "norsk",
	participantsLimit: 10,
	hostingCompany: { name: "Bedrift", id: "company-id" },
	organizers: [{ userId: "user-id" as never, role: "hovedansvarlig" as never }],
	externalEvent: false,
};

describe("eventFormSchema", () => {
	it("requires a product when productRequired is true and none is chosen", () => {
		const result = eventFormSchema(true).safeParse(values);
		expect(result.success).toBe(false);
		expect(result.error?.issues).toContainEqual(
			expect.objectContaining({ path: ["productId"], message: "Velg et produkt" }),
		);
	});

	it("passes when productRequired is true and a product is chosen", () => {
		const result = eventFormSchema(true).safeParse({ ...values, productId: "product-id" });
		expect(result.success).toBe(true);
	});

	it("passes without a product when productRequired is false", () => {
		const result = eventFormSchema(false).safeParse(values);
		expect(result.success).toBe(true);
	});
});
