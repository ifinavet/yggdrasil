import { describe, expect, it } from "vitest";
import { readEmailLinkToken } from "./email-link-token";

const token = `${"a".repeat(40)}-_B`;

describe("readEmailLinkToken", () => {
	it("reads the token from the fragment", () => {
		expect(readEmailLinkToken(`#token=${token}`)).toBe(token);
		expect(readEmailLinkToken(`token=${token}`)).toBe(token);
	});

	it("rejects missing or malformed tokens", () => {
		expect(readEmailLinkToken("")).toBeNull();
		expect(readEmailLinkToken("#token=")).toBeNull();
		expect(readEmailLinkToken("#token=short")).toBeNull();
		expect(readEmailLinkToken(`#token=${token.slice(1)}!`)).toBeNull();
		expect(readEmailLinkToken(`#other=${token}`)).toBeNull();
	});
});
