import { describe, expect, it } from "vitest";
import { LIFETIME, scopeArgs, scopeLabel, scopeValue } from "./leaderboard-scope";

describe("leaderboard scope", () => {
	const autumn = { semester: "høst", year: 2026 } as const;

	it("describes a semester", () => {
		expect(scopeValue(autumn)).toBe("2026-høst");
		expect(scopeLabel(autumn)).toBe("Høst 2026");
		expect(scopeArgs(autumn)).toEqual({ semester: autumn });
	});

	it("describes the lifetime scope without a semester filter", () => {
		expect(scopeValue(LIFETIME)).toBe("totalt");
		expect(scopeLabel(LIFETIME)).toBe("Gjennom tidene");
		expect(scopeArgs(LIFETIME)).toEqual({});
	});
});
