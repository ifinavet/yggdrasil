import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterestForm } from "./interest-form";

const register = vi.hoisted(() => vi.fn(async (_args: Record<string, string | undefined>) => null));

vi.mock("convex/react", () => ({ useMutation: () => register }));

describe("InterestForm", () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
		register.mockClear();
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		act(() => root.render(<InterestForm />));
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	function type(label: string, value: string) {
		const input = [...container.querySelectorAll("label")].find(
			(element) => element.textContent === label,
		)?.control as HTMLInputElement;
		const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
		act(() => {
			setValue?.call(input, value);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}

	async function submit() {
		await act(async () => {
			container.querySelector("form")?.requestSubmit();
		});
	}

	it("sends the trimmed name and email, then thanks the company", async () => {
		type("Bedrift", " Fjordkode AS ");
		type("E-post", " ingrid@fjordkode.no ");
		await submit();

		expect(register).toHaveBeenCalledWith({
			companyName: "Fjordkode AS",
			email: "ingrid@fjordkode.no",
			website: undefined,
		});
		expect(container.textContent).toContain(
			"Takk! Vi gir beskjed til ingrid@fjordkode.no når søknadene åpner.",
		);
	});

	it("shows what is missing and sends nothing", async () => {
		type("E-post", "ingrid");
		await submit();

		expect(register).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Skriv navnet på bedriften.");
		expect(container.textContent).toContain("Skriv en gyldig e-postadresse.");
	});
});
