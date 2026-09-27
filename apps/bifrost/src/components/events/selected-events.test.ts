import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SelectedEvents from "./selected-events";

const store = vi.hoisted(() => ({ events: [] as string[], clearEvents: () => {} }));

vi.mock("@/lib/stores/selected-events", () => ({
	useSelectedEventsStore: <T>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("posthog-js/react", () => ({ usePostHog: () => ({ captureException: vi.fn() }) }));

function render() {
	return renderToStaticMarkup(createElement(SelectedEvents));
}

describe("SelectedEvents", () => {
	beforeEach(() => {
		store.events = [];
	});

	it("renders nothing when no events are selected", () => {
		expect(render()).toBe("");
	});

	it("shows the update button with the count once events are selected", () => {
		store.events = ["event1", "event2"];

		const markup = render();

		expect(markup).toContain("Oppdater 2 valgte arrangementer");
		expect(markup).not.toMatch(/\sdisabled=""/);
	});
});
