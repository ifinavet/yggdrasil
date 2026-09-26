import { isUioEmail, onboardingSchema, suggestWorkspaceEmail } from "@workspace/shared/iam";
import { describe, expect, it } from "vitest";

describe("suggestWorkspaceEmail", () => {
	it("turns Norwegian names into plain addresses", () => {
		expect(suggestWorkspaceEmail("Øystein Åge", "Bjørnstad-Ærø", "ifinavet.no")).toBe(
			"oystein.age.bjornstad.aero@ifinavet.no",
		);
		expect(suggestWorkspaceEmail("José", "Müller", "ifinavet.no")).toBe("jose.muller@ifinavet.no");
	});

	it("suggests nothing until there is a name", () => {
		expect(suggestWorkspaceEmail(" ", "", "ifinavet.no")).toBe("");
	});
});

describe("isUioEmail", () => {
	it("accepts UiO and its subdomains only", () => {
		expect(isUioEmail("kari@uio.no")).toBe(true);
		expect(isUioEmail("kari@student.uio.no")).toBe(true);
		expect(isUioEmail("kari@fakeuio.no")).toBe(false);
	});
});

describe("onboardingSchema", () => {
	const valid = {
		firstName: "Kari",
		lastName: "Nordmann",
		uioEmail: " KariNor@UiO.no ",
		workspaceEmail: "Kari.Nordmann@ifinavet.no",
		group: "Bedrift",
	};

	it("normalizes both addresses", () => {
		expect(onboardingSchema("ifinavet.no").parse(valid)).toMatchObject({
			uioEmail: "karinor@uio.no",
			workspaceEmail: "kari.nordmann@ifinavet.no",
		});
	});

	it("explains each missing field", () => {
		const result = onboardingSchema("ifinavet.no").safeParse({
			firstName: "",
			lastName: "",
			uioEmail: "kari@gmail.com",
			workspaceEmail: "kari@gmail.com",
			group: "",
		});
		expect(result.error?.issues.map((issue) => issue.message)).toEqual([
			"Skriv fornavnet.",
			"Skriv etternavnet.",
			"Bruk UiO-adressen, den som slutter på uio.no.",
			"Adressen må slutte på @ifinavet.no.",
			"Velg en gruppe.",
		]);
	});
});
