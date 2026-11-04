import { defaultApplicationSemester } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import { deadlineCountdown, homeApplySemester } from "./home-apply-semester";

const spring = { year: 2027, term: "spring" as const, applicationDeadline: "2026-12-01" };

describe("homeApplySemester", () => {
	it("is null while no semester is open", () => {
		expect(homeApplySemester("2026-11-04", [])).toBeNull();
	});

	it("is the open semester before its deadline", () => {
		expect(homeApplySemester("2026-11-04", [spring])).toBe(spring);
	});

	it("still counts the deadline day", () => {
		expect(homeApplySemester("2026-12-01", [spring])).toBe(spring);
	});

	it("is null after the deadline", () => {
		expect(homeApplySemester("2026-12-02", [spring])).toBeNull();
	});

	it("picks the semester the Hugin form starts on when several are open", () => {
		const autumn = { year: 2027, term: "autumn" as const, applicationDeadline: "2027-06-01" };
		const open = [autumn, spring];
		expect(homeApplySemester("2026-11-04", open)).toBe(
			defaultApplicationSemester("2026-11-04", open),
		);
		expect(homeApplySemester("2026-11-04", open)).toBe(spring);
	});
});

describe("deadlineCountdown", () => {
	it("counts the days left", () => {
		expect(deadlineCountdown("2026-11-04", "2026-12-04")).toBe("30 dager igjen");
	});

	it("uses the singular for one day", () => {
		expect(deadlineCountdown("2026-12-03", "2026-12-04")).toBe("1 dag igjen");
	});

	it("says it is the last day on the deadline", () => {
		expect(deadlineCountdown("2026-12-04", "2026-12-04")).toBe("Siste dag i dag");
	});

	it("counts across a daylight saving change", () => {
		expect(deadlineCountdown("2026-10-24", "2026-10-26")).toBe("2 dager igjen");
	});
});
