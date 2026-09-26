import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { ENTRY_PATH, entryRedirect } from "./entry-redirect";

const ORIGIN = "https://bifrost.example.test";

function request(path: string, fetchSite?: string) {
	return new NextRequest(`${ORIGIN}${path}`, {
		headers: fetchSite ? { "sec-fetch-site": fetchSite } : {},
	});
}

describe("entryRedirect", () => {
	it.each(["none", "cross-site", "same-site", undefined])(
		"sends a fresh visit to the front page on to the events (%s)",
		(fetchSite) => {
			expect(entryRedirect(request("/", fetchSite))?.headers.get("location")).toBe(
				`${ORIGIN}${ENTRY_PATH}`,
			);
		},
	);

	it("keeps the front page when navigating from inside Bifrost", () => {
		expect(entryRedirect(request("/", "same-origin"))).toBeUndefined();
	});

	it("leaves other pages alone", () => {
		expect(entryRedirect(request("/companies", "none"))).toBeUndefined();
	});
});
