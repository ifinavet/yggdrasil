import { describe, expect, it } from "vitest";
import {
	changeAuthor,
	changeInitials,
	changeTimestamp,
	formatChangeValue,
	moveProductId,
	productChangeEntries,
} from "./product-history-format";

const nbsp = (text: string) => text.replace(/\s/g, " ");

describe("product history format", () => {
	it("formats stored JSON values for display", () => {
		expect(nbsp(formatChangeValue("unitPriceOre", "3000000"))).toBe("30 000 kr");
		expect(formatChangeValue("vatRate", "25")).toBe("25 %");
		expect(formatChangeValue("sortOrder", "0")).toBe("1");
		expect(formatChangeValue("category", '"job_listing"')).toBe("Stillingsannonse");
		expect(formatChangeValue("active", "false")).toBe("Arkivert");
		expect(formatChangeValue("name", '"Kurs"')).toBe("Kurs");
		expect(nbsp(formatChangeValue("volumeTiers", '[{"quantity":1,"totalPriceOre":300000}]'))).toBe(
			"3 000 kr for 1",
		);
	});

	it("shows missing and empty values as tom", () => {
		expect(formatChangeValue("maxStudents", undefined)).toBe("tom");
		expect(formatChangeValue("shortDescription", '""')).toBe("tom");
	});

	it("describes each updated field with a before and after value", () => {
		const entries = productChangeEntries("updated", [
			{ field: "unitPriceOre", before: "2800000", after: "3000000" },
			{ field: "maxStudents", before: "35", after: "40" },
		]);
		expect(entries.map((entry) => entry.description)).toEqual([
			"endret pris",
			"endret maks studenter",
		]);
		expect(entries[0]?.diff && nbsp(entries[0].diff.after)).toBe("30 000 kr");
		expect(entries[1]?.diff).toEqual({ before: "35", after: "40" });
	});

	it("leaves out the diff for descriptions", () => {
		const [entry] = productChangeEntries("updated", [
			{ field: "longDescription", before: '"Gammel"', after: '"Ny"' },
		]);
		expect(entry).toEqual({ key: "longDescription", description: "endret lang beskrivelse" });
	});

	it("shows only the new value when a field was empty before", () => {
		const [entry] = productChangeEntries("updated", [{ field: "startupPriceOre", after: "50000" }]);
		expect(entry?.description).toBe("endret pris for oppstartsbedrifter");
		expect(entry?.diff?.before).toBeUndefined();
		expect(entry?.diff && nbsp(entry.diff.after)).toBe("500 kr");
	});

	it("falls back to the raw field name for unknown fields", () => {
		const [entry] = productChangeEntries("updated", [{ field: "fikenId", after: '"1"' }]);
		expect(entry?.description).toBe("endret fikenId");
	});

	it("describes status changes with a verb and no diff", () => {
		const changes = [{ field: "active", before: "true", after: "false" }];
		expect(productChangeEntries("created", [])).toEqual([
			{ key: "created", description: "opprettet produktet" },
		]);
		expect(productChangeEntries("archived", changes)[0]?.description).toBe("arkiverte produktet");
		expect(productChangeEntries("restored", changes)[0]?.description).toBe(
			"gjenopprettet produktet",
		);
	});

	it("shows the new position when a product was moved", () => {
		expect(
			productChangeEntries("reordered", [{ field: "sortOrder", before: "2", after: "1" }]),
		).toEqual([
			{ key: "reordered", description: "flyttet produktet", diff: { before: "3", after: "2" } },
		]);
		expect(productChangeEntries("reordered", [])[0]?.diff).toBeUndefined();
	});

	it("counts assigned events", () => {
		const assigned = (count?: string) =>
			productChangeEntries(
				"assigned",
				count === undefined ? [] : [{ field: "assignedEvents", after: count }],
			)[0]?.description;
		expect(assigned("12")).toBe("merket 12 arrangementer med produktet");
		expect(assigned("1")).toBe("merket 1 arrangement med produktet");
		expect(assigned()).toBe("merket 0 arrangementer med produktet");
	});

	it("names the author and falls back to Navet", () => {
		expect(changeAuthor("Kari Nordmann")).toBe("Kari Nordmann");
		expect(changeAuthor(null)).toBe("Navet");
		expect(changeInitials("Kari Nordmann")).toBe("KN");
		expect(changeInitials("Kari Anne Nordmann")).toBe("KN");
		expect(changeInitials("kari")).toBe("K");
		expect(changeInitials(null)).toBe("NV");
	});

	it("formats the timestamp in Oslo time", () => {
		expect(changeTimestamp(Date.UTC(2026, 7, 12, 12, 2))).toBe("12.08.2026 kl. 14:02");
	});

	it("moves an id up or down without touching the input", () => {
		const ids = ["a", "b", "c"];
		expect(moveProductId(ids, 1, -1)).toEqual(["b", "a", "c"]);
		expect(moveProductId(ids, 1, 1)).toEqual(["a", "c", "b"]);
		expect(ids).toEqual(["a", "b", "c"]);
	});
});
