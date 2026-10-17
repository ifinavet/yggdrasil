import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateCalendar } from "./date-calendar";

// Tuesday 26 and Thursday 28 January, and Tuesday 2 February 2027.
const DATES = ["2027-01-26", "2027-01-28", "2027-02-02"];

describe("DateCalendar", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		container = document.createElement("div");
		root = createRoot(container);
	});

	afterEach(() => act(() => root.unmount()));

	function render(
		value: string[],
		{ max, onChange = () => {} }: { max?: number; onChange?: (dates: string[]) => void } = {},
	) {
		act(() =>
			root.render(
				<DateCalendar
					dates={DATES}
					value={value}
					onChange={onChange}
					invalid={false}
					labelledBy="label"
					{...(max === undefined ? {} : { max })}
				/>,
			),
		);
		const buttons = [...container.querySelectorAll("button")];
		const actions = buttons.map((button) => button.textContent);
		const day = (date: string) =>
			container.querySelector<HTMLButtonElement>(`td[data-day="${date}"] button`);
		return { actions, day };
	}

	it("shows each open month, with only the open dates enabled", () => {
		const { actions, day } = render(["2027-01-26"]);

		expect(container.textContent).toContain("Januar 2027");
		expect(container.textContent).toContain("Februar 2027");
		expect(actions).toContain("Velg alle");
		expect(DATES.map((date) => day(date)?.disabled)).toEqual([false, false, false]);
		expect(day("2027-01-27")?.disabled).toBe(true);
	});

	it("adds and removes a date when it is pressed", () => {
		const onChange = vi.fn();
		const { day } = render(["2027-01-26"], { onChange });

		act(() => day("2027-02-02")?.click());
		expect(onChange).toHaveBeenLastCalledWith(["2027-01-26", "2027-02-02"]);

		act(() => day("2027-01-26")?.click());
		expect(onChange).toHaveBeenLastCalledWith([]);
	});

	it("leaves out «Velg alle» with a limit, and locks the other dates once it is reached", () => {
		expect(DATES.some((date) => render(["2027-01-26"], { max: 2 }).day(date)?.disabled)).toBe(
			false,
		);

		const { actions, day } = render(["2027-01-26", "2027-02-02"], { max: 2 });

		expect(actions).not.toContain("Velg alle");
		expect(DATES.map((date) => day(date)?.disabled)).toEqual([false, true, false]);
	});
});
