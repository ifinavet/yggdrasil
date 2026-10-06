import { describe, expect, it } from "vitest";
import { organizerMarker } from "./organizer-role";

describe("organizerMarker", () => {
	it("returns nothing when the user is not an organizer", () => {
		expect(organizerMarker(null, false)).toBeNull();
		expect(organizerMarker(undefined, true)).toBeNull();
	});

	it("uses the solid primary color for the lead organizer", () => {
		expect(organizerMarker("hovedansvarlig", false)).toEqual({
			label: "Du er ansvarlig",
			className: "bg-primary text-primary-foreground",
		});
	});

	it("uses the light primary color for a co-organizer", () => {
		expect(organizerMarker("medhjelper", false)).toEqual({
			label: "Du er medansvarlig",
			className: "bg-primary-light text-primary",
		});
	});

	it("speaks in past tense for finished events", () => {
		expect(organizerMarker("hovedansvarlig", true)?.label).toBe("Du var ansvarlig");
		expect(organizerMarker("medhjelper", true)?.label).toBe("Du var medansvarlig");
	});
});
