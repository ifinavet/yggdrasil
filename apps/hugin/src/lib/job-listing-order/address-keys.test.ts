import { describe, expect, it } from "vitest";
import { addressKeyTarget, movesSuggestionHighlight } from "./address-keys";

const key = (name: string, ctrlKey = false) => ({ key: name, ctrlKey });
const open = { open: true, navigated: false };
const navigated = { open: true, navigated: true };
const closed = { open: false, navigated: false };

describe("addressKeyTarget", () => {
	it("keeps Enter in the input until the user has moved through the suggestions", () => {
		expect(addressKeyTarget(key("Enter"), open)).toBe("input");
		expect(addressKeyTarget(key("Enter"), navigated)).toBe("suggestions");
	});

	it("keeps every key in the input while the suggestions are closed", () => {
		expect(addressKeyTarget(key("Enter"), closed)).toBe("input");
		expect(addressKeyTarget(key("ArrowDown"), closed)).toBe("input");
	});

	it("keeps caret keys in the input while the suggestions are open", () => {
		expect(addressKeyTarget(key("Home"), navigated)).toBe("input");
		expect(addressKeyTarget(key("End"), navigated)).toBe("input");
	});

	it("sends navigation keys to the open suggestions", () => {
		expect(addressKeyTarget(key("ArrowDown"), open)).toBe("suggestions");
		expect(addressKeyTarget(key("ArrowUp"), open)).toBe("suggestions");
	});
});

describe("movesSuggestionHighlight", () => {
	it("counts arrow keys and control vim bindings as navigation", () => {
		expect(movesSuggestionHighlight(key("ArrowDown"))).toBe(true);
		expect(movesSuggestionHighlight(key("ArrowUp"))).toBe(true);
		expect(movesSuggestionHighlight(key("n", true))).toBe(true);
		expect(movesSuggestionHighlight(key("k", true))).toBe(true);
	});

	it("ignores typing and plain letters", () => {
		expect(movesSuggestionHighlight(key("n"))).toBe(false);
		expect(movesSuggestionHighlight(key("Enter"))).toBe(false);
		expect(movesSuggestionHighlight(key("a", true))).toBe(false);
	});
});
