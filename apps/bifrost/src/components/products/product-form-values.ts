import {
	DEFAULT_VAT_RATE,
	kronerToOre,
	oreToKroner,
	type ProductCategory,
	type ProductInput,
	productInputSchema,
	type VolumeTier,
} from "@workspace/shared/products";

export type TierFormValues = { quantity: string; totalPrice: string };

export type ProductFormValues = {
	name: string;
	shortDescription: string;
	longDescription: string;
	category: ProductCategory;
	unitPrice: string;
	vatRate: string;
	volumeTiers: TierFormValues[];
	startupPrice: string;
	maxStudents: string;
};

type FormField = keyof ProductFormValues;

const FORM_FIELD_BY_INPUT_FIELD: Record<keyof ProductInput, FormField> = {
	name: "name",
	shortDescription: "shortDescription",
	longDescription: "longDescription",
	category: "category",
	unitPriceOre: "unitPrice",
	vatRate: "vatRate",
	volumeTiers: "volumeTiers",
	startupPriceOre: "startupPrice",
	maxStudents: "maxStudents",
};

export const emptyProductFormValues: ProductFormValues = {
	name: "",
	shortDescription: "",
	longDescription: "",
	category: "event",
	unitPrice: "",
	vatRate: String(DEFAULT_VAT_RATE),
	volumeTiers: [],
	startupPrice: "",
	maxStudents: "",
};

function parseDecimal(value: string): number | undefined {
	const normalized = value.replace(/\s/g, "").replace(",", ".");
	return normalized === "" ? undefined : Number(normalized);
}

function kronerFieldToOre(value: string): number | undefined {
	const kroner = parseDecimal(value);
	return kroner === undefined ? undefined : kronerToOre(kroner);
}

function oreToKronerField(ore: number | undefined): string {
	return ore === undefined ? "" : String(oreToKroner(ore));
}

export function toProductInput(values: ProductFormValues): ProductInput {
	const isJobListing = values.category === "job_listing";
	return {
		name: values.name,
		shortDescription: values.shortDescription,
		longDescription: values.longDescription,
		category: values.category,
		unitPriceOre: kronerFieldToOre(values.unitPrice),
		vatRate: parseDecimal(values.vatRate) ?? Number.NaN,
		volumeTiers:
			isJobListing && values.volumeTiers.length > 0
				? values.volumeTiers.map((tier) => ({
						quantity: parseDecimal(tier.quantity) ?? Number.NaN,
						totalPriceOre: kronerFieldToOre(tier.totalPrice) ?? Number.NaN,
					}))
				: undefined,
		startupPriceOre: isJobListing ? kronerFieldToOre(values.startupPrice) : undefined,
		maxStudents: parseDecimal(values.maxStudents),
	};
}

export function toProductFormValues(product: {
	name: string;
	shortDescription: string;
	longDescription: string;
	category: ProductCategory;
	unitPriceOre?: number;
	vatRate: number;
	volumeTiers?: VolumeTier[];
	startupPriceOre?: number;
	maxStudents?: number;
}): ProductFormValues {
	return {
		name: product.name,
		shortDescription: product.shortDescription,
		longDescription: product.longDescription,
		category: product.category,
		unitPrice: oreToKronerField(product.unitPriceOre),
		vatRate: String(product.vatRate),
		volumeTiers: (product.volumeTiers ?? []).map((tier) => ({
			quantity: String(tier.quantity),
			totalPrice: oreToKronerField(tier.totalPriceOre),
		})),
		startupPrice: oreToKronerField(product.startupPriceOre),
		maxStudents: product.maxStudents === undefined ? "" : String(product.maxStudents),
	};
}

export function validateProductForm(values: ProductFormValues) {
	const result = productInputSchema.safeParse(toProductInput(values));
	if (result.success) return undefined;

	const fields: Partial<Record<FormField, string>> = {};
	for (const issue of result.error.issues) {
		const field = FORM_FIELD_BY_INPUT_FIELD[issue.path[0] as keyof ProductInput];
		fields[field] ??= issue.message;
	}
	return { fields };
}
