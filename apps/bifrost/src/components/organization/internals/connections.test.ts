import { describe, expect, it } from "vitest";
import { type Connections, googleConnection, slackConnection } from "./connections";

function connections(overrides: Partial<Connections>): Connections {
	return {
		uioEmail: "karinor@uio.no",
		google: "created",
		welcomeSent: true,
		slackLinked: false,
		...overrides,
	};
}

describe("googleConnection", () => {
	it("counts created and reused accounts as connected", () => {
		expect(googleConnection(connections({ google: "created" })).connected).toBe(true);
		expect(googleConnection(connections({ google: "existing" })).connected).toBe(true);
	});

	it("treats pending, suspended and missing accounts as not connected", () => {
		for (const google of ["pending", "suspended", "not_applicable"] as const) {
			expect(googleConnection(connections({ google })).connected).toBe(false);
		}
	});
});

describe("slackConnection", () => {
	it("is connected once Slack knows the member", () => {
		expect(slackConnection(connections({ slackLinked: true }))).toEqual({
			connected: true,
			text: "Er med i Slack",
		});
	});

	it("tells an unanswered invite apart from no invite", () => {
		expect(slackConnection(connections({ welcomeSent: true })).text).toBe(
			"Invitert, har ikke blitt med ennå",
		);
		expect(slackConnection(connections({ welcomeSent: false })).text).toBe("Ikke invitert ennå");
	});
});
