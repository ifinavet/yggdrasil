import type { Id } from "@workspace/backend/convex/dataModel";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EventFeedbackReport } from "../feedback/event-feedback-report";
import { FeedbackManualSend } from "../feedback/feedback-manual-send";
import { EventReminderSettings } from "./event-reminder-settings";

vi.mock("@workspace/ui/hooks/use-feature-enabled", () => ({
	useFeatureEnabled: () => {
		throw new Error("Event email UI must not depend on feature flags or browser opt-ins");
	},
}));

vi.mock("convex/react", () => ({
	useQuery: () => undefined,
	useMutation: () => Object.assign(vi.fn(), { withOptimisticUpdate: () => vi.fn() }),
	useAction: () => vi.fn(),
}));

const eventId = "event-id" as Id<"events">;

describe("event email UI without preview opt-ins", () => {
	it("renders reminder settings immediately with the toggle off while loading", () => {
		const html = renderToStaticMarkup(<EventReminderSettings eventId={eventId} />);
		expect(html).toContain("Påminnelser");
		expect(html).toContain('aria-checked="false"');
		expect(html).toContain("disabled");
	});

	it("renders the feedback report instead of the legacy fallback", () => {
		const html = renderToStaticMarkup(
			<EventFeedbackReport eventId={eventId} fallback={<p>Legacy report</p>} />,
		);
		expect(html).toContain("Henter rapport");
		expect(html).not.toContain("Legacy report");
	});

	it("renders manual feedback sending", () => {
		const html = renderToStaticMarkup(<FeedbackManualSend eventId={eventId} />);
		expect(html).toContain("Send skjema");
		expect(html).toContain("Velg en deltaker");
	});
});
