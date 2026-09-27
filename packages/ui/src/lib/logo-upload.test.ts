import { LOGO_MESSAGES } from "@workspace/shared/logo";
import { describe, expect, it } from "vitest";
import { LogoCompressionError } from "./logo-compression";
import { logoUploadErrorMessage } from "./logo-upload";

describe("logoUploadErrorMessage", () => {
	it("shows the compression problem", () => {
		expect(logoUploadErrorMessage(new LogoCompressionError(LOGO_MESSAGES.tooLarge), "Feil")).toBe(
			LOGO_MESSAGES.tooLarge,
		);
	});

	it("falls back to the shared upload message", () => {
		expect(logoUploadErrorMessage(new Error("network"))).toBe(LOGO_MESSAGES.uploadFailed);
	});

	it("falls back to the caller's message when given", () => {
		expect(logoUploadErrorMessage(new Error("network"), "Feil")).toBe("Feil");
	});
});
