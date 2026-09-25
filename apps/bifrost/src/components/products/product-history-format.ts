import type { Doc } from "@workspace/backend/convex/dataModel";
import {
	formatNok,
	formatVolumeTier,
	PRODUCT_CATEGORY_LABELS,
	type ProductCategory,
	type VolumeTier,
} from "@workspace/shared/products";
import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";

type ProductChange = Doc<"productChanges">;
type ProductChangeAction = ProductChange["action"];
type FieldChange = ProductChange["changes"][number];

export type ProductChangeEntry = {
	key: string;
	description: string;
	diff?: { before?: string; after: string };
};

const SYSTEM_AUTHOR = "Navet";
const SYSTEM_INITIALS = "NV";
const EMPTY_VALUE = "tom";

const ACTION_DESCRIPTIONS: Record<Exclude<ProductChangeAction, "updated" | "assigned">, string> = {
	created: "opprettet produktet",
	archived: "arkiverte produktet",
	restored: "gjenopprettet produktet",
	reordered: "flyttet produktet",
};

const FIELD_NAMES: Record<string, string> = {
	name: "navn",
	shortDescription: "kort beskrivelse",
	longDescription: "lang beskrivelse",
	category: "kategori",
	unitPriceOre: "pris",
	vatRate: "mva",
	volumeTiers: "mengderabatter",
	startupPriceOre: "pris for oppstartsbedrifter",
	maxStudents: "maks studenter",
};

const FIELDS_WITHOUT_DIFF = new Set(["shortDescription", "longDescription"]);

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
			return (value as VolumeTier[]).map((tier) => formatVolumeTier(tier)).join(", ");
		default:
			return typeof value === "string" ? value : JSON.stringify(value);
	}
}

export function formatChangeValue(field: string, raw: string | undefined) {
	if (raw === undefined) return EMPTY_VALUE;
	const formatted = formatParsed(field, JSON.parse(raw));
	return formatted === "" ? EMPTY_VALUE : formatted;
}

function diffOf({ field, before, after }: FieldChange) {
	return {
		before: before === undefined ? undefined : formatChangeValue(field, before),
		after: formatChangeValue(field, after),
	};
}

function assignedCount(changes: readonly FieldChange[]) {
	const after = changes.find((change) => change.field === "assignedEvents")?.after;
	return after === undefined ? 0 : (JSON.parse(after) as number);
}

export function productChangeEntries(
	action: ProductChangeAction,
	changes: readonly FieldChange[],
): ProductChangeEntry[] {
	switch (action) {
		case "updated":
			return changes.map((change) => ({
				key: change.field,
				description: `endret ${FIELD_NAMES[change.field] ?? change.field}`,
				diff: FIELDS_WITHOUT_DIFF.has(change.field) ? undefined : diffOf(change),
			}));
		case "assigned": {
			const count = assignedCount(changes);
			return [
				{
					key: action,
					description: `merket ${count} ${count === 1 ? "arrangement" : "arrangementer"} med produktet`,
				},
			];
		}
		case "reordered": {
			const sortOrder = changes.find((change) => change.field === "sortOrder");
			return [
				{
					key: action,
					description: ACTION_DESCRIPTIONS.reordered,
					diff: sortOrder && diffOf(sortOrder),
				},
			];
		}
		default:
			return [{ key: action, description: ACTION_DESCRIPTIONS[action] }];
	}
}

export function changeAuthor(name: string | null) {
	return name ?? SYSTEM_AUTHOR;
}

export function changeInitials(name: string | null) {
	if (name === null) return SYSTEM_INITIALS;
	const words = name.trim().split(/\s+/);
	const first = words[0]?.[0] ?? "";
	const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
	return `${first}${last}`.toUpperCase();
}

export function changeTimestamp(time: number) {
	return `${formatOsloDate(time, DATE_PATTERNS.numericDate)} kl. ${formatOsloDate(time, DATE_PATTERNS.time)}`;
}

export function moveProductId<T>(ids: readonly T[], index: number, offset: number) {
	const next = [...ids];
	const [id] = next.splice(index, 1);
	if (id !== undefined) next.splice(index + offset, 0, id);
	return next;
}
