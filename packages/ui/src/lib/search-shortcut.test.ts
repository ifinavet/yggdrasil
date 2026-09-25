import { describe, expect, it } from "vitest";
import { searchShortcutKeys } from "./search-shortcut";

describe("searchShortcutKeys", () => {
	it("shows the command key on Macs", () => {
		expect(searchShortcutKeys("macOS")).toEqual(["⌘", "K"]);
		expect(searchShortcutKeys("MacIntel")).toEqual(["⌘", "K"]);
	});

	it("shows Ctrl everywhere else", () => {
		expect(searchShortcutKeys("Windows")).toEqual(["Ctrl", "K"]);
		expect(searchShortcutKeys("Win32")).toEqual(["Ctrl", "K"]);
		expect(searchShortcutKeys("Linux x86_64")).toEqual(["Ctrl", "K"]);
		expect(searchShortcutKeys("iPad")).toEqual(["Ctrl", "K"]);
		expect(searchShortcutKeys("iPhone")).toEqual(["Ctrl", "K"]);
	});
});
