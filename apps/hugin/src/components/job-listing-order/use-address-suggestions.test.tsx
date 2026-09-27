import { addressSearchSessionSchema } from "@workspace/shared/job-listing-orders";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAddressSuggestions } from "./use-address-suggestions";

const searchAddresses = vi.fn(async (_args: { query: string; sessionId: string }) => []);

vi.mock("convex/react", () => ({ useAction: () => searchAddresses }));

function Suggestions({ value }: Readonly<{ value: string }>) {
	useAddressSuggestions(value, true);
	return null;
}

describe("useAddressSuggestions", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		vi.useFakeTimers();
		searchAddresses.mockClear();
		container = document.createElement("div");
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
	});

	async function search(value: string) {
		act(() => root.render(<Suggestions value={value} />));
		await act(() => vi.runAllTimersAsync());
	}

	function sessionIds(): string[] {
		return searchAddresses.mock.calls.map(([args]) => args.sessionId);
	}

	it("sends the same uuid session id for every search while mounted", async () => {
		await search("Storgata 1");
		await search("Storgata 12");

		const [first, second] = sessionIds();
		expect(searchAddresses).toHaveBeenCalledTimes(2);
		expect(addressSearchSessionSchema.safeParse(first).success).toBe(true);
		expect(second).toBe(first);
	});

	it("starts a new session id on a new mount", async () => {
		await search("Storgata 1");
		act(() => root.unmount());
		root = createRoot(container);
		await search("Storgata 1");

		const [first, second] = sessionIds();
		expect(searchAddresses).toHaveBeenCalledTimes(2);
		expect(second).not.toBe(first);
	});
});
