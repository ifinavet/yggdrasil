import type { ApplicationStatus } from "@workspace/shared/semester/labels";
import { isValidOrgNumber, toCompanyProfileOrgNumber } from "@workspace/shared/semester/orgNumber";
import {
	addOsloDays,
	isIsoDate,
	isPresentationDay,
	nextTermAfter,
	osloDateTimeToEpoch,
	osloToday,
	presentationDaysBetween,
	termOfDay,
} from "@workspace/shared/semester/time";
import { describe, expect, it } from "vitest";
import { generateLinkToken, hashLinkToken, LINK_TOKEN_LENGTH } from "../lib/tokens";
import { canTransition, isActiveApplicationStatus, TRANSITIONS } from "./rules";

const STATUSES = Object.keys(TRANSITIONS) as ApplicationStatus[];

const ALLOWED: [ApplicationStatus, ApplicationStatus][] = [
	["applied", "offer_sent"],
	["applied", "rejected"],
	["applied", "withdrawn"],
	["offer_sent", "confirmed"],
	["offer_sent", "new_date_requested"],
	["offer_sent", "offer_sent"],
	["offer_sent", "applied"],
	["offer_sent", "withdrawn"],
	["new_date_requested", "offer_sent"],
	["new_date_requested", "applied"],
	["new_date_requested", "rejected"],
	["new_date_requested", "withdrawn"],
	["confirmed", "withdrawn"],
	["rejected", "applied"],
	["withdrawn", "applied"],
];

describe("status transitions", () => {
	it.each(ALLOWED)("allows %s → %s", (from, to) => {
		expect(canTransition(from, to)).toBe(true);
	});

	const forbidden = STATUSES.flatMap((from) =>
		STATUSES.filter((to) => !ALLOWED.some(([a, b]) => a === from && b === to)).map(
			(to) => [from, to] as [ApplicationStatus, ApplicationStatus],
		),
	);

	it.each(forbidden)("forbids %s → %s", (from, to) => {
		expect(canTransition(from, to)).toBe(false);
	});

	it("never moves a confirmed application to another offer", () => {
		expect(TRANSITIONS.confirmed).toEqual(["withdrawn"]);
	});

	it("treats rejected and withdrawn as the only closed statuses", () => {
		expect(STATUSES.filter((status) => !isActiveApplicationStatus(status))).toEqual([
			"rejected",
			"withdrawn",
		]);
	});
});

describe("organization numbers", () => {
	it.each(["982463718", "923609016", "982 463 718"])("accepts %s", (value) => {
		expect(isValidOrgNumber(value)).toBe(true);
	});

	it.each([
		["wrong check digit", "982463719"],
		["too short", "98246371"],
		["too long", "9824637180"],
		["letters", "98246371A"],
		["empty", ""],
	])("rejects a number with %s", (_reason, value) => {
		expect(isValidOrgNumber(value)).toBe(false);
	});

	it("converts to the number stored on company profiles", () => {
		expect(toCompanyProfileOrgNumber("982 463 718")).toBe(982463718);
	});
});

describe("semester days", () => {
	it("lists the Tuesdays and Thursdays of spring 2027 like the mockup", () => {
		const days = presentationDaysBetween("2027-01-19", "2027-05-06");
		expect(days).toHaveLength(32);
		expect(days.slice(0, 3)).toEqual(["2027-01-19", "2027-01-21", "2027-01-26"]);
		expect(days.every(isPresentationDay)).toBe(true);
	});

	it("keeps weekdays across the daylight-saving change", () => {
		expect(presentationDaysBetween("2027-03-25", "2027-04-01")).toEqual([
			"2027-03-25",
			"2027-03-30",
			"2027-04-01",
		]);
	});

	it.each([
		["2026-09-23", { year: 2027, term: "spring" }],
		["2026-07-01", { year: 2027, term: "spring" }],
		["2026-06-30", { year: 2026, term: "autumn" }],
		["2027-03-01", { year: 2027, term: "autumn" }],
	] as const)("the term after %s is %o", (today, next) => {
		expect(nextTermAfter(today)).toEqual(next);
	});

	it.each([
		["2027-06-30", { year: 2027, term: "spring" }],
		["2027-07-01", { year: 2027, term: "autumn" }],
		["2027-12-31", { year: 2027, term: "autumn" }],
	] as const)("%s belongs to %o", (day, term) => {
		expect(termOfDay(day)).toEqual(term);
	});

	it.each(["2027-02-29", "2027-13-01", "27-01-01", "2027-1-5"])("rejects %s as a day", (value) => {
		expect(isIsoDate(value)).toBe(false);
	});
});

describe("Oslo time", () => {
	it("uses the Oslo calendar day, not UTC", () => {
		expect(osloToday(Date.parse("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
		expect(osloToday(Date.parse("2027-06-30T21:59:00Z"))).toBe("2027-06-30");
	});

	it("turns an Oslo day and time into the right instant in winter and summer", () => {
		expect(osloDateTimeToEpoch("2027-02-09", "16:15")).toBe(Date.parse("2027-02-09T15:15:00Z"));
		expect(osloDateTimeToEpoch("2027-06-01", "16:15")).toBe(Date.parse("2027-06-01T14:15:00Z"));
	});

	it("adds days and keeps the Oslo wall-clock time across the switch to summer time", () => {
		// Friday 26 March 12:00 in Oslo (UTC+1) plus a week is Friday 2 April 12:00 (UTC+2).
		expect(addOsloDays(Date.parse("2027-03-26T11:00:00Z"), 7)).toBe(
			Date.parse("2027-04-02T10:00:00Z"),
		);
		expect(addOsloDays(Date.parse("2027-01-31T11:00:00Z"), 1)).toBe(
			Date.parse("2027-02-01T11:00:00Z"),
		);
	});

	it.each([
		["an hour past 23", "2027-02-09", "25:00"],
		["a single-digit hour", "2027-02-09", "9:00"],
		["the skipped spring-forward hour", "2027-03-28", "02:30"],
	])("refuses %s", (_reason, date, time) => {
		expect(() => osloDateTimeToEpoch(date, time)).toThrow();
	});
});

describe("link tokens", () => {
	it("are URL-safe and unique", () => {
		const tokens = new Set(Array.from({ length: 50 }, generateLinkToken));
		expect(tokens.size).toBe(50);
		for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(LINK_TOKEN_LENGTH).toBe(43);
	});

	it("hash to the same value every time, and differently per token", async () => {
		const token = generateLinkToken();
		expect(await hashLinkToken(token)).toBe(await hashLinkToken(token));
		expect(await hashLinkToken(token)).not.toBe(await hashLinkToken(generateLinkToken()));
	});
});
