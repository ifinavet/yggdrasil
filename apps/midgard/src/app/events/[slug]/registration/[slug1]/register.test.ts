import type { Id } from "@workspace/backend/convex/dataModel";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Register from "./register";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => mutate }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function html(response?: "accept" | "decline") {
	return renderToStaticMarkup(
		createElement(Register, {
			registrationId: "registration" as Id<"registrations">,
			eventId: "event" as Id<"events">,
			response,
		}),
	);
}

describe("waitlist email response confirmation", () => {
	beforeEach(() => vi.clearAllMocks());
	it("shows both options for the original link", () => {
		expect(html()).toContain("Ja, jeg vil ha plassen");
		expect(html()).toContain("Nei, gi plassen videre");
		expect(mutate).not.toHaveBeenCalled();
	});
	it("asks for confirmation of yes without accepting on render", () => {
		const content = html("accept");
		expect(content).toContain("Bekreft ja, jeg vil ha plassen");
		expect(content).not.toContain("Nei, gi plassen videre");
		expect(content).toContain("Endre svar");
		expect(mutate).not.toHaveBeenCalled();
	});
	it("asks for confirmation of no without declining on render", () => {
		const content = html("decline");
		expect(content).toContain("Bekreft nei, gi plassen videre");
		expect(content).not.toContain("Ja, jeg vil ha plassen");
		expect(content).toContain("Endre svar");
		expect(mutate).not.toHaveBeenCalled();
	});
});
