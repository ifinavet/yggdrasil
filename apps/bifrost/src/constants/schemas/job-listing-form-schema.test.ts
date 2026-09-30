import { expect, it } from "vitest";
import { jobListingFormSchema } from "./job-listing-form-schema";

const latestDeadline = new Date("2027-03-30T20:00:00Z");
const values = {
	title: "Jobb",
	teaser: "Hei!",
	description: "Beskrivelse",
	deadline: latestDeadline,
	type: "Trainee",
	company: { name: "Navet", id: "company-id" },
	contacts: [{ name: "Navn" }],
	applicationUrl: "https://example.com",
};

it("accepts short public-order text and custom job types when editing", () => {
	expect(jobListingFormSchema(latestDeadline).safeParse(values).success).toBe(true);
});

it("accepts the largest teaser supported by the public order settings", () => {
	expect(
		jobListingFormSchema(latestDeadline).safeParse({ ...values, teaser: "a".repeat(500) }).success,
	).toBe(true);
	expect(
		jobListingFormSchema(latestDeadline).safeParse({ ...values, teaser: "a".repeat(501) }).success,
	).toBe(false);
});

it.each(["title", "teaser", "type"])("still requires %s", (field) => {
	expect(jobListingFormSchema(latestDeadline).safeParse({ ...values, [field]: "" }).success).toBe(
		false,
	);
});
