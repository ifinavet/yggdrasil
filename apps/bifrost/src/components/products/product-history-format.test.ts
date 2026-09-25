import { describe, expect, it } from "vitest";
import { formatChangeValue, moveProductId } from "./product-history-format";

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
			"1 for 3 000 kr",
		);
	});

	it("shows missing and empty values as tom", () => {
		expect(formatChangeValue("maxStudents", undefined)).toBe("tom");
		expect(formatChangeValue("shortDescription", '""')).toBe("tom");
	});

	it("moves an id up or down without touching the input", () => {
		const ids = ["a", "b", "c"];
		expect(moveProductId(ids, 1, -1)).toEqual(["b", "a", "c"]);
		expect(moveProductId(ids, 1, 1)).toEqual(["a", "c", "b"]);
		expect(ids).toEqual(["a", "b", "c"]);
	});
});
