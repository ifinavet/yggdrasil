import type { Id } from "@workspace/backend/convex/dataModel";
import {
	JOB_LISTING_ORDER_DEFAULTS,
	MAX_LISTINGS_PER_ORDER,
} from "@workspace/shared/job-listing-orders";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyListing } from "@/lib/job-listing-order/form-values";
import { type ListingProduct, PackagePicker } from "./package-picker";
import { type OrderFormApi, useOrderForm } from "./use-order-form";

vi.mock("@workspace/ui/components/rich-text-editor", () => ({ RichTextEditor: () => null }));

const product: ListingProduct = {
	_id: "product" as Id<"products">,
	name: "Stillingsannonse",
	shortDescription: "",
	volumeTiers: [
		{ quantity: 1, totalPriceOre: 300000 },
		{ quantity: 3, totalPriceOre: 750000 },
	],
	startupPriceOre: 100000,
};
let form: OrderFormApi;
let root: Root;
let container: HTMLDivElement;

function TestForm() {
	const context = useRef({ productId: product._id, companyOnFile: null });
	form = useOrderForm({ settings: JOB_LISTING_ORDER_DEFAULTS, context, onSubmit: async () => {} });
	return (
		<PackagePicker
			form={form}
			product={product}
			settings={JOB_LISTING_ORDER_DEFAULTS}
			today="2026-09-30"
		/>
	);
}

beforeEach(() => {
	localStorage.clear();
	Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	act(() => root.render(<TestForm />));
});
afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function click(text: string) {
	const button = [...container.querySelectorAll("button")].find(
		(item) => item.textContent === text,
	);
	if (!button) throw new Error(`Missing button: ${text}`);
	act(() => button.click());
}

it("shows one ad by default, adds on demand, and preserves extra text across no/yes", () => {
	expect(container.querySelectorAll("h3")).toHaveLength(1);
	expect(container.textContent).not.toContain("Legg til annonse");
	click("Ja");
	act(() => form.setFieldValue("listings[1].title", "Utvikler"));
	click("Legg til annonse");
	expect(container.querySelectorAll("h3")).toHaveLength(3);
	act(() => form.setFieldValue("confirmAmount", true));
	click("Nei");
	expect(form.state.values.listings).toHaveLength(1);
	expect(form.state.values.confirmAmount).toBe(false);
	expect(container.querySelectorAll("h3")).toHaveLength(1);
	click("Ja");
	expect(form.state.values.listings).toHaveLength(3);
	expect(form.state.values.listings[1]?.title).toBe("Utvikler");
	click("Fjern");
	expect(form.state.values.listings).toHaveLength(2);
});

it("recognizes restored multiple listings, caps additions, and updates startup pricing", () => {
	act(() =>
		form.setFieldValue("listings", Array.from({ length: MAX_LISTINGS_PER_ORDER }, emptyListing)),
	);
	expect(container.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe("Ja");
	const add = [...container.querySelectorAll("button")].find(
		(button) => button.textContent === "Legg til annonse",
	);
	expect(add?.disabled).toBe(true);
	act(() => container.querySelector<HTMLButtonElement>('[role="switch"]')?.click());
	expect(container.querySelector("output")?.textContent?.replace(/\s/g, "")).toBe("10000kr");
	click("Fjern");
	expect(add?.disabled).toBe(false);
	expect(form.state.values.listings).toHaveLength(MAX_LISTINGS_PER_ORDER - 1);
});
