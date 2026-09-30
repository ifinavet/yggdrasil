import { describe, expect, it } from "vitest";
import { redirectFromSearch, safeRedirectPath, withRedirect } from "./auth-redirect";

describe("safeRedirectPath", () => {
	it("keeps internal paths", () => {
		expect(safeRedirectPath("/events/bedpres-acme")).toBe("/events/bedpres-acme");
	});

	it.each([
		null,
		undefined,
		"",
		"events",
		"https://evil.example",
		"//evil.example",
		"/\\evil.example",
		"/\t/evil.example",
		"/\n/evil.example",
		"/\r\n/evil.example",
	])("falls back to the front page for %s", (value) => {
		expect(safeRedirectPath(value)).toBe("/");
	});
});

describe("redirectFromSearch", () => {
	it("reads an encoded redirect with query and extra params", () => {
		const search = "redirect=%2Fevents%2Facme%3Ftab%3Dinfo&utm_source=mail";
		expect(redirectFromSearch(search)).toBe("/events/acme?tab=info");
	});

	it("reads redirect when it is not the first param", () => {
		expect(redirectFromSearch("utm_source=mail&redirect=%2Fevents%2Facme")).toBe("/events/acme");
	});

	it("falls back to the front page without a redirect", () => {
		expect(redirectFromSearch("")).toBe("/");
	});
});

describe("withRedirect", () => {
	it("round-trips through redirectFromSearch", () => {
		const href = withRedirect("/sign-up", "/events/acme?tab=info");
		expect(href.startsWith("/sign-up?")).toBe(true);
		expect(redirectFromSearch(href.split("?").slice(1).join("?"))).toBe("/events/acme?tab=info");
	});

	it("drops external targets", () => {
		expect(withRedirect("/sign-in", "https://evil.example")).toBe("/sign-in?redirect=%2F");
	});
});
