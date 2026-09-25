import { MAX_OFFER_COMMENT_LENGTH, MAX_REQUESTED_DATES } from "@workspace/shared/semester/limits";
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { companyErrorMessage } from "./company-error-message";
import {
	dayInSentence,
	offerDayHeading,
	offerSemesterName,
	osloDayAndTime,
	osloDayMonth,
	pickableDayLabel,
} from "./company-offer-format";
import { acceptOfferSchema, requestNewDateSchema } from "./schema/company-offer-schema";

describe("offer formatting", () => {
	it("writes the offered day as a heading", () => {
		expect(offerDayHeading("2027-02-09")).toBe("Tirsdag 9. februar 2027");
	});

	it("writes pickable days without the weekday's full stop", () => {
		expect(pickableDayLabel("2027-02-02")).toBe("Tir 2. februar");
		expect(pickableDayLabel("2027-01-28")).toBe("Tor 28. januar");
		expect(dayInSentence("2027-02-16")).toBe("tir 16. februar");
	});

	it("uses the Oslo day and time, not the machine's", () => {
		// 23:30 UTC on 17 December is already 18 December in Oslo.
		const lateEvening = Date.UTC(2026, 11, 17, 23, 30);
		expect(osloDayMonth(lateEvening)).toBe("18. desember");
		expect(osloDayAndTime(Date.UTC(2026, 11, 5, 7, 31))).toBe("5. desember kl. 08:31");
		// Summer time: UTC+2.
		expect(osloDayAndTime(Date.UTC(2026, 5, 1, 6, 5))).toBe("1. juni kl. 08:05");
	});

	it("names the semester from the offered day", () => {
		expect(offerSemesterName("2027-02-09")).toBe("Våren 2027");
		expect(offerSemesterName("2026-09-10", { inSentence: true })).toBe("høsten 2026");
	});

	it("shows the backend's Norwegian message, and a general one otherwise", () => {
		expect(companyErrorMessage(new ConvexError("Velg blant datoene i semesteret."))).toBe(
			"Velg blant datoene i semesteret.",
		);
		expect(companyErrorMessage(new Error("network"))).toMatch(/^Noe gikk galt/);
	});
});

describe("offer answer rules", () => {
	it("requires the terms to be accepted", () => {
		expect(acceptOfferSchema.safeParse({ acceptTerms: false }).success).toBe(false);
		expect(acceptOfferSchema.safeParse({ acceptTerms: true }).success).toBe(true);
	});

	it("needs between one and the maximum number of dates", () => {
		const dates = (count: number) =>
			Array.from({ length: count }, (_, day) => `2027-02-${String(day + 1).padStart(2, "0")}`);
		expect(requestNewDateSchema.safeParse({ dates: [], comment: "" }).success).toBe(false);
		expect(requestNewDateSchema.safeParse({ dates: dates(1), comment: "" }).success).toBe(true);
		expect(
			requestNewDateSchema.safeParse({ dates: dates(MAX_REQUESTED_DATES), comment: "" }).success,
		).toBe(true);
		expect(
			requestNewDateSchema.safeParse({ dates: dates(MAX_REQUESTED_DATES + 1), comment: "" })
				.success,
		).toBe(false);
	});

	it("limits the comment length after trimming", () => {
		const long = "a".repeat(MAX_OFFER_COMMENT_LENGTH);
		expect(
			requestNewDateSchema.safeParse({ dates: ["2027-02-02"], comment: ` ${long} ` }).success,
		).toBe(true);
		expect(
			requestNewDateSchema.safeParse({ dates: ["2027-02-02"], comment: `${long}a` }).success,
		).toBe(false);
	});
});
