import { describe, expect, it } from "vitest";
import { isPrivatePath, isPrivateUrl } from "./private-paths";

describe("private paths", () => {
	it("covers the token pages and nothing else", () => {
		expect(isPrivatePath("/feedback")).toBe(true);
		expect(isPrivatePath("/report")).toBe(true);
		expect(isPrivatePath("/bestill-bedpres/tilbud/abc123")).toBe(true);
		expect(isPrivatePath("/bestill-bedpres")).toBe(false);
		expect(isPrivatePath("/bestill-bedpres/kvittering")).toBe(false);
		expect(isPrivatePath("/feedback-archive")).toBe(false);
	});

	it("reads full URLs, links with a fragment and route names", () => {
		expect(isPrivateUrl("https://hugin.ifinavet.no/bestill-bedpres/tilbud/abc?x=1")).toBe(true);
		expect(isPrivateUrl("/feedback#invite=secret")).toBe(true);
		expect(isPrivateUrl("GET /bestill-bedpres/tilbud/[token]")).toBe(true);
		expect(isPrivateUrl("https://hugin.ifinavet.no/bestill-bedpres")).toBe(false);
		expect(isPrivateUrl(undefined)).toBe(false);
		expect(isPrivateUrl("not a url")).toBe(false);
	});
});
