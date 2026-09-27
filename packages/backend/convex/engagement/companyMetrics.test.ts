import { HOUR_MS } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
	averageOf,
	type CompanyEvent,
	comparisonOf,
	type Metrics,
	metricsOf,
} from "./companyMetrics";

const OPENS = 1_000_000;
const NOW = OPENS + 1000 * HOUR_MS;

function companyEvent(
	participationLimit: number,
	registrations: Partial<Doc<"registrations">>[],
	{ eventStart = NOW - HOUR_MS, lateUnregistrations = null as number | null } = {},
): CompanyEvent {
	return {
		event: {
			participationLimit,
			registrationOpens: OPENS,
			eventStart,
			hostingCompany: "company" as Id<"companies">,
		} as Doc<"events">,
		registrations: registrations.map(
			(registration) =>
				({
					status: "registered",
					registrationTime: OPENS,
					...registration,
				}) as Doc<"registrations">,
		),
		lateUnregistrations,
	};
}

const metrics = (overrides: Partial<Metrics>): Metrics => ({
	demand: null,
	fill: null,
	waitlistPerEvent: null,
	hoursToFull: null,
	attendance: null,
	noShow: null,
	latePerEvent: null,
	...overrides,
});

describe("metricsOf", () => {
	it("measures demand, fill, waitlist, attendance and late unregistrations", () => {
		const held = companyEvent(
			2,
			[
				{ attendanceStatus: "confirmed", registrationTime: OPENS + HOUR_MS },
				{ attendanceStatus: "no_show", registrationTime: OPENS + 3 * HOUR_MS },
				{ status: "waitlist", registrationTime: OPENS + 4 * HOUR_MS },
			],
			{ lateUnregistrations: 2 },
		);
		const upcoming = companyEvent(2, [{}], { eventStart: NOW + HOUR_MS });

		expect(metricsOf([held, upcoming], NOW)).toEqual({
			demand: 4 / 4,
			fill: 3 / 4,
			waitlistPerEvent: 0.5,
			hoursToFull: 3,
			attendance: 0.5,
			noShow: 0.5,
			latePerEvent: 2,
		});
	});

	it("takes the median time to full and leaves unmeasured metrics empty", () => {
		const fullAfter = (hours: number) =>
			companyEvent(1, [{ registrationTime: OPENS + hours * HOUR_MS }], { eventStart: NOW + 1 });

		expect(metricsOf([fullAfter(1), fullAfter(2), fullAfter(6), fullAfter(9)], NOW)).toMatchObject({
			hoursToFull: 4,
			attendance: null,
			noShow: null,
			latePerEvent: null,
		});
		expect(metricsOf([fullAfter(1), fullAfter(2), fullAfter(6)], NOW).hoursToFull).toBe(2);
		expect(metricsOf([companyEvent(0, [])], NOW)).toEqual(metrics({ waitlistPerEvent: 0 }));
	});
});

describe("comparisonOf", () => {
	it("averages every company and ranks in the direction that is better", () => {
		const company = metrics({ demand: 1, hoursToFull: 2 });
		const all = [
			company,
			metrics({ demand: 3, hoursToFull: 1 }),
			metrics({ demand: 0.5, hoursToFull: 5 }),
		];

		expect(averageOf(all)).toMatchObject({ demand: 1.5, hoursToFull: 8 / 3, fill: null });
		expect(
			comparisonOf(company, all)
				.filter(({ key }) => key !== "fill")
				.slice(0, 3),
		).toEqual([
			{ key: "demand", value: 1, average: 1.5, rank: 2, of: 3 },
			{ key: "waitlistPerEvent", value: null, average: null, rank: null, of: 0 },
			{ key: "hoursToFull", value: 2, average: 8 / 3, rank: 2, of: 3 },
		]);
	});
});
