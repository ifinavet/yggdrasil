import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DateGrid } from "./date-grid";

const DATES = ["2027-01-26", "2027-01-28", "2027-02-02"];

describe("DateGrid", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		container = document.createElement("div");
		root = createRoot(container);
	});

	afterEach(() => act(() => root.unmount()));

	function render(value: string[], max?: number) {
		act(() =>
			root.render(
				<DateGrid
					dates={DATES}
					value={value}
					onChange={() => {}}
					invalid={false}
					labelledBy="label"
					{...(max === undefined ? {} : { max })}
				/>,
			),
		);
		const boxes = [...container.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
		const buttons = [...container.querySelectorAll("button")].map((button) => button.textContent);
		return { boxes, buttons };
	}

	it("offers «Velg alle» and every date without a limit", () => {
		const { boxes, buttons } = render(["2027-01-26"]);

		expect(buttons).toContain("Velg alle");
		expect(boxes.map((box) => box.disabled)).toEqual([false, false, false]);
	});

	it("leaves out «Velg alle» with a limit, and locks the other dates once it is reached", () => {
		expect(render(["2027-01-26"], 2).boxes.some((box) => box.disabled)).toBe(false);

		const { boxes, buttons } = render(["2027-01-26", "2027-02-02"], 2);

		expect(buttons).not.toContain("Velg alle");
		expect(boxes.map((box) => box.disabled)).toEqual([false, true, false]);
	});
});
