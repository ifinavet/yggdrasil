import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddressInput } from "./address-input";

vi.mock("./use-address-suggestions", () => ({ useAddressSuggestions: () => [] }));

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

describe("AddressInput", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	});

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
});
