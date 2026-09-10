import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement these, but Radix primitives (Popover, Select, ...) call them.
if (typeof Element !== "undefined") {
	if (!Element.prototype.hasPointerCapture) {
		Element.prototype.hasPointerCapture = () => false;
	}
	if (!Element.prototype.setPointerCapture) {
		Element.prototype.setPointerCapture = () => {};
	}
	if (!Element.prototype.releasePointerCapture) {
		Element.prototype.releasePointerCapture = () => {};
	}
	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
}

if (globalThis.ResizeObserver === undefined) {
	class ResizeObserverStub {
		observe() {
			// no-op: jsdom has no layout, so there's nothing to observe
		}
		unobserve() {
			// no-op: nothing was ever observed
		}
		disconnect() {
			// no-op: nothing was ever observed
		}
	}
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof window !== "undefined" && !window.matchMedia) {
	window.matchMedia = (query: string) =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as unknown as MediaQueryList;
}
