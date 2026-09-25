import {
	formatNok,
	PRODUCT_CATEGORY_LABELS,
	type ProductCategory,
	type VolumeTier,
} from "@workspace/shared/products";

export const PRODUCT_ACTION_LABELS = {
	created: "Opprettet",
	updated: "Endret",
	archived: "Arkivert",
	restored: "Gjenopprettet",
	reordered: "Flyttet",
} as const;

export const PRODUCT_FIELD_LABELS: Record<string, string> = {
	name: "Navn",
	shortDescription: "Kort beskrivelse",
	longDescription: "Lang beskrivelse",
	category: "Kategori",
	unitPriceOre: "Pris",
	vatRate: "Mva",
	volumeTiers: "Mengderabatter",
	startupPriceOre: "Oppstartspris",
	maxStudents: "Maks studenter",
	sortOrder: "Plassering",
	active: "Status",
};

const EMPTY_VALUE = "tom";

function formatParsed(field: string, value: unknown): string {
	switch (field) {
		case "unitPriceOre":
		case "startupPriceOre":
			return formatNok(value as number);
		case "vatRate":
			return `${value as number} %`;
		case "sortOrder":
			return String((value as number) + 1);
		case "category":
			return PRODUCT_CATEGORY_LABELS[value as ProductCategory];
		case "active":
			return value ? "Aktiv" : "Arkivert";
		case "volumeTiers":
			return (value as VolumeTier[])
				.map((tier) => `${tier.quantity} for ${formatNok(tier.totalPriceOre)}`)
				.join(", ");
		default:
			return typeof value === "string" ? value : JSON.stringify(value);
	}
}

export function formatChangeValue(field: string, raw: string | undefined) {
	if (raw === undefined) return EMPTY_VALUE;
	const formatted = formatParsed(field, JSON.parse(raw));
	return formatted === "" ? EMPTY_VALUE : formatted;
}

export function moveProductId<T>(ids: readonly T[], index: number, offset: number) {
	const next = [...ids];
	const [id] = next.splice(index, 1);
	if (id !== undefined) next.splice(index + offset, 0, id);
	return next;
}
