import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressInput } from "./address-input";

const suggestions = vi.hoisted(() => ({ current: [] as string[] }));

vi.mock("./use-address-suggestions", () => ({ useAddressSuggestions: () => suggestions.current }));

function LabelledAddress() {
	const [inputId, setInputId] = useState<string>();
	return (
		<>
			<label htmlFor={inputId}>Adresse</label>
			<AddressInput
				label="Adresse"
				value=""
				invalid={false}
				onChange={() => {}}
				onBlur={() => {}}
				onInputId={setInputId}
			/>
		</>
	);
}

function ControlledAddress({ onChange }: Readonly<{ onChange: (value: string) => void }>) {
	const [value, setValue] = useState("");
	return (
		<AddressInput
			label="Adresse"
			value={value}
			invalid={false}
			onChange={(next) => {
				setValue(next);
				onChange(next);
			}}
			onBlur={() => {}}
			onInputId={() => {}}
		/>
	);
}

function type(input: HTMLInputElement, text: string) {
	const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	act(() => {
		setValue?.call(input, text);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

function press(input: HTMLInputElement, key: string) {
	act(() => {
		input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
	});
}

describe("AddressInput", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, {
			IS_REACT_ACT_ENVIRONMENT: true,
			ResizeObserver: class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		});
		Element.prototype.scrollIntoView = () => {};
		suggestions.current = [];
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	});

	function renderControlled(onChange: (value: string) => void) {
		act(() => root.render(<ControlledAddress onChange={onChange} />));
		const input = container.querySelector("input[cmdk-input]");
		if (!(input instanceof HTMLInputElement)) throw new Error("Address input did not render");
		return input;
	}

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it("points the visible label at the input cmdk renders", () => {
		act(() => root.render(<LabelledAddress />));

		const input = container.querySelector("input[cmdk-input]");
		const label = container.querySelector<HTMLLabelElement>("label:not([cmdk-label])");

		expect(input?.id).toBeTruthy();
		expect(label?.htmlFor).toBe(input?.id);
		expect(label?.control).toBe(input);
	});

	it("picks the highlighted suggestion on Enter after arrow navigation", () => {
		const onChange = vi.fn();
		suggestions.current = ["Storgata 1, 0155 OSLO"];
		const input = renderControlled(onChange);

		type(input, "Stor");
		press(input, "ArrowDown");
		press(input, "Enter");

		expect(onChange).toHaveBeenLastCalledWith("Storgata 1, 0155 OSLO");
	});

	it("keeps the typed text on Enter when typing after arrow navigation", () => {
		const onChange = vi.fn();
		suggestions.current = ["Storgata 1, 0155 OSLO"];
		const input = renderControlled(onChange);

		type(input, "Stor");
		press(input, "ArrowDown");
		type(input, "Storg");
		press(input, "Enter");

		expect(onChange).toHaveBeenLastCalledWith("Storg");
		expect(onChange).not.toHaveBeenCalledWith("Storgata 1, 0155 OSLO");
	});
});
