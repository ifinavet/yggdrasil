import { convexErrorMessage } from "@workspace/shared/utils";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

describe("convexErrorMessage", () => {
	it("shows the message a Convex function threw", () => {
		expect(convexErrorMessage(new ConvexError("Bestillingsskjemaet er stengt."), "Feil")).toBe(
			"Bestillingsskjemaet er stengt.",
		);
	});

	it("falls back for unexpected errors", () => {
		expect(convexErrorMessage(new Error("Server Error"), "Feil")).toBe("Feil");
		expect(convexErrorMessage(new ConvexError({ code: 1 }), "Feil")).toBe("Feil");
	});
});
