import { defaultApplicationSemester } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import { homeApplySemester } from "./home-apply-semester";

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
