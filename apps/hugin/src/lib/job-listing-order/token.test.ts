import { describe, expect, it } from "vitest";
import { readOrderToken } from "./token";

const token = `${"a".repeat(40)}-_B`;

describe("readOrderToken", () => {
	it("reads the token from the fragment", () => {
		expect(readOrderToken(`#token=${token}`)).toBe(token);
		expect(readOrderToken(`token=${token}`)).toBe(token);
	});

	it("rejects missing or malformed tokens", () => {
		expect(readOrderToken("")).toBeNull();
		expect(readOrderToken("#token=")).toBeNull();
		expect(readOrderToken("#token=short")).toBeNull();
		expect(readOrderToken(`#token=${token.slice(1)}!`)).toBeNull();
		expect(readOrderToken(`#other=${token}`)).toBeNull();
	});
});
