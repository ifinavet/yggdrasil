import { describe, expect, it } from "vitest";
import {
	CONFIRMATION_TTL_MS,
	confirmationFields,
	confirmationState,
	validEmailToken,
} from "./emailConfirmation";
import { generateLinkToken } from "./tokens";

describe("email confirmation", () => {
	it("stores a hash and expires unused confirmations after 24 hours", async () => {
		const token = generateLinkToken();
		expect(validEmailToken(token)).toBe(true);
		const fields = await confirmationFields(token, 1000);
		expect(fields.tokenHash).not.toBe(token);
		expect(confirmationState(fields, 1000 + CONFIRMATION_TTL_MS - 1)).toBe("valid");
		expect(confirmationState(fields, 1000 + CONFIRMATION_TTL_MS)).toBe("expired");
		expect(confirmationState({ ...fields, usedAt: 2000 }, fields.expiresAt)).toBe("valid");
		expect(confirmationState(null, 1000)).toBe("invalid");
	});
	it("rejects malformed tokens", () => {
		expect(validEmailToken("")).toBe(false);
		expect(validEmailToken("!".repeat(43))).toBe(false);
	});
});
