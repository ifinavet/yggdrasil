import { JOB_LISTING_ORDER_DEFAULTS } from "@workspace/shared/job-listing-orders";
import { describe, expect, it } from "vitest";
import { companyCopy } from "./copy";
import { emptyOrderForm, type OrderFormValues } from "./form-values";
import {
	billingRequired,
	companyChangeErrors,
	fieldPath,
	type OrderContext,
	orderFormErrors,
	toOrderForm,
} from "./submit";

const today = "2026-09-25";
const settings = JOB_LISTING_ORDER_DEFAULTS;
const companyOnFile = { name: "Acme", description: "<p>Om Acme</p>", hasBilling: true };
const context: OrderContext = { productId: "product-1", companyOnFile };
const billing = { address: "Gate 1", email: "faktura@acme.no", reference: "Ola" };

const listing = {
	title: "Utvikler",
	teaser: "Bli med på laget",
	description: "<p>Kode</p>",
	applicationUrl: "https://acme.no/jobb",
	deadline: "2026-10-01",
	type: settings.jobTypes[0] ?? "",
};

function validValues(overrides: Partial<OrderFormValues> = {}): OrderFormValues {
	const values = emptyOrderForm();
	return {
		...values,
		company: { ...values.company, companyId: "company-1" },
		companyCorrect: "yes",
		listings: [listing],
		contact: { name: "Kari", email: "kari@acme.no", phone: "" },
		confirmAmount: true,
		...overrides,
	};
}

describe("toOrderForm", () => {
	it("sends only what an existing company confirmed as correct", () => {
		expect(toOrderForm(validValues(), context)).toEqual({
			company: { kind: "existing", companyId: "company-1" },
			productId: "product-1",
			startup: false,
			listings: [listing],
			contact: { name: "Kari", email: "kari@acme.no" },
			ehfInvoice: false,
			confirmAmount: true,
		});
	});

	it("sends EHF even when the billing on file is kept", () => {
		const form = toOrderForm(validValues({ ehfInvoice: true }), context);
		expect(form.ehfInvoice).toBe(true);
		expect(form).not.toHaveProperty("billing");
	});

	it("keeps the phone and a trimmed note when given", () => {
		const form = toOrderForm(
			validValues({
				contact: { name: "Kari", email: "kari@acme.no", phone: "+47 12345678" },
				note: "  Hei  ",
			}),
			context,
		);
		expect(form.contact.phone).toBe("+47 12345678");
		expect(form.note).toBe("Hei");
	});

	it("sends only fields that differ from the company on file when the answer is no", () => {
		const form = toOrderForm(
			validValues({
				companyCorrect: "no",
				companyChanges: { displayName: " Acme ", description: "<p>Ny tekst</p>", logo: "" },
			}),
			context,
		);
		expect(form.companyChanges).toEqual({ description: "<p>Ny tekst</p>" });
	});

	it("drops an empty rich text description from the changes", () => {
		const form = toOrderForm(
			validValues({
				companyCorrect: "no",
				companyChanges: { displayName: "Acme AS", description: "<p></p>", logo: "storage-1" },
			}),
			context,
		);
		expect(form.companyChanges).toEqual({ displayName: "Acme AS", logo: "storage-1" });
	});

	it("ignores change fields when the answer is yes", () => {
		const form = toOrderForm(
			validValues({ companyChanges: { displayName: "Annet", description: "", logo: "" } }),
			context,
		);
		expect(form).not.toHaveProperty("companyChanges");
	});

	it("maps a new company from the registry", () => {
		const form = toOrderForm(
			validValues({
				company: {
					kind: "new",
					companyId: "",
					orgNumber: "923609016",
					registryName: "ACME AS",
					displayName: "Acme",
					description: "<p>Om</p>",
					logo: "storage-2",
				},
				companyChanges: { displayName: "Ignorert", description: "", logo: "" },
				companyCorrect: "no",
			}),
			context,
		);
		expect(form.company).toEqual({
			kind: "new",
			orgNumber: "923609016",
			displayName: "Acme",
			description: "<p>Om</p>",
			logo: "storage-2",
		});
		expect(form).not.toHaveProperty("companyChanges");
	});

	it("sends billing only when required or when the user chose to change it", () => {
		const values = validValues({ billing });
		const withoutBilling = { ...context, companyOnFile: { ...companyOnFile, hasBilling: false } };
		expect(toOrderForm(values, withoutBilling).billing).toEqual(billing);
		expect(toOrderForm(values, context)).not.toHaveProperty("billing");
		expect(toOrderForm({ ...values, changeBilling: true }, context).billing).toEqual(billing);
	});
});

describe("billingRequired", () => {
	it("requires billing for new companies and companies without billing on file", () => {
		const values = validValues();
		const newCompany = { ...values, company: { ...values.company, kind: "new" as const } };
		expect(billingRequired(values, companyOnFile)).toBe(false);
		expect(billingRequired(values, { ...companyOnFile, hasBilling: false })).toBe(true);
		expect(billingRequired(values, null)).toBe(true);
		expect(billingRequired(newCompany, companyOnFile)).toBe(true);
	});
});

describe("fieldPath", () => {
	it("formats array indexes the way TanStack Form names fields", () => {
		expect(fieldPath(["listings", 2, "title"])).toBe("listings[2].title");
		expect(fieldPath(["company", "companyId"])).toBe("company.companyId");
		expect(fieldPath(["confirmAmount"])).toBe("confirmAmount");
	});
});

describe("orderFormErrors", () => {
	it("accepts a complete order", () => {
		expect(orderFormErrors(validValues(), context, settings, today)).toEqual({});
	});

	it("asks for a yes or no on an existing company", () => {
		const errors = orderFormErrors(validValues({ companyCorrect: "" }), context, settings, today);
		expect(errors.companyCorrect).toBe(companyCopy.answerRequired);
	});

	it("asks for a company before anything else about it", () => {
		const values = validValues({ companyCorrect: "" });
		const errors = orderFormErrors(
			{ ...values, company: { ...values.company, companyId: "" } },
			context,
			settings,
			today,
		);
		expect(errors["company.companyId"]).toBe("Velg bedriften.");
		expect(errors).not.toHaveProperty("companyCorrect");
	});

	it("keys listing errors by field name", () => {
		const errors = orderFormErrors(
			validValues({ listings: [listing, { ...listing, deadline: "2026-09-24", title: "" }] }),
			context,
			settings,
			today,
		);
		expect(errors["listings[1].deadline"]).toBe("Søknadsfristen har passert.");
		expect(errors["listings[1].title"]).toBe(
			`Tittelen kan ha høyst ${settings.titleMaxLength} tegn.`,
		);
		expect(errors).not.toHaveProperty("listings[0].title");
	});

	it("requires billing fields when billing is required", () => {
		const errors = orderFormErrors(
			validValues(),
			{ ...context, companyOnFile: { ...companyOnFile, hasBilling: false } },
			settings,
			today,
		);
		expect(errors["billing.address"]).toBe("Skriv fakturaadressen.");
	});

	it("rejects a no answer without any change", () => {
		const errors = orderFormErrors(
			validValues({
				companyCorrect: "no",
				companyChanges: { displayName: "Acme", description: "<p>Om Acme</p>", logo: "" },
			}),
			context,
			settings,
			today,
		);
		expect(errors.companyChanges).toBe("Endre minst ett felt, eller svar ja.");
	});

	it("requires the amount to be confirmed", () => {
		const errors = orderFormErrors(validValues({ confirmAmount: false }), context, settings, today);
		expect(errors.confirmAmount).toBe("Bekreft bestillingen og beløpet.");
	});
});

describe("companyChangeErrors", () => {
	const changesTo = (companyChanges: OrderFormValues["companyChanges"]) =>
		validValues({ companyCorrect: "no", companyChanges });

	it("accepts a changed display name", () => {
		const values = changesTo({ displayName: "Acme AS", description: "<p>Om Acme</p>", logo: "" });
		expect(companyChangeErrors(values, companyOnFile)).toEqual({});
	});

	it("accepts a new logo alone", () => {
		const values = changesTo({
			displayName: "Acme",
			description: "<p>Om Acme</p>",
			logo: "storage-1",
		});
		expect(companyChangeErrors(values, companyOnFile)).toEqual({});
	});

	it("rejects changes identical to what is on file", () => {
		const values = changesTo({ displayName: " Acme ", description: "<p>Om Acme</p>", logo: "" });
		expect(companyChangeErrors(values, companyOnFile)).toEqual({
			companyChanges: "Endre minst ett felt, eller svar ja.",
		});
	});

	it("reports a too long display name on its field", () => {
		const values = changesTo({ displayName: "A".repeat(101), description: "", logo: "" });
		expect(companyChangeErrors(values, companyOnFile)).toHaveProperty([
			"companyChanges.displayName",
		]);
	});
});
