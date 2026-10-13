import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRedirectCountdown } from "./use-redirect-countdown";

const onDone = vi.fn();
let remaining = 0;

function tick(times: number) {
	for (let i = 0; i < times; i++) act(() => vi.advanceTimersByTime(1000));
}

function Countdown({ paused }: Readonly<{ paused: boolean }>) {
	remaining = useRedirectCountdown(3, paused, onDone);
	return null;
}

describe("useRedirectCountdown", () => {
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		vi.useFakeTimers();
		onDone.mockClear();
		root = createRoot(document.createElement("div"));
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
	});

	it("counts down and fires once at zero", () => {
		act(() => root.render(<Countdown paused={false} />));
		tick(1);
		expect(remaining).toBe(2);
		expect(onDone).not.toHaveBeenCalled();
		tick(2);
		expect(remaining).toBe(0);
		expect(onDone).toHaveBeenCalledTimes(1);
		tick(5);
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("stops while paused", () => {
		act(() => root.render(<Countdown paused={false} />));
		tick(1);
		act(() => root.render(<Countdown paused />));
		tick(10);
		expect(remaining).toBe(2);
		expect(onDone).not.toHaveBeenCalled();
	});
});
