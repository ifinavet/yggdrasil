import { describe, expect, it } from "vitest";
import {
	alertActivity,
	cohortTints,
	defaultSelection,
	type EngagementAlert,
	type EngagementStatus,
	fillShare,
	followUpNote,
	formatDelta,
	formatPoints,
	formatShare,
	lateUnregistrationNote,
	opensLabel,
	statusBadge,
	timeslotGrid,
	type UnregisterLog,
	type UpcomingData,
} from "./engagement-format";

const nbsp = (text: string) => text.replace(/\s/g, " ");

describe("statusBadge", () => {
	it.each([
		[{ kind: "notOpen" }, "Venter", "outline"],
		[{ kind: "wave" }, "Avmeldingsbølge", "default"],
		[{ kind: "full", minutesToFull: 12 }, "Fullt på 12 min", "secondary"],
		[{ kind: "noRegistrations" }, "Ingen påmeldte", "soft"],
		[{ kind: "behind" }, "Bak tempo", "soft"],
		[{ kind: "ahead" }, "Foran tempo", "secondary"],
		[{ kind: "onPace" }, "I rute", "muted"],
	])("labels %o", (status, label, variant) => {
		expect(statusBadge(status as EngagementStatus)).toEqual({ label, variant });
	});
});

describe("formatDelta", () => {
	it("signs positive, negative and zero deltas", () => {
		expect(formatDelta(3)).toBe("+3");
		expect(formatDelta(-4)).toBe("−4");
		expect(formatDelta(0)).toBe("0");
	});
});

describe("formatShare and formatPoints", () => {
	it("formats fractions as percent and percentage points", () => {
		expect(nbsp(formatShare(0.25))).toBe("25 %");
		expect(formatPoints(0.034)).toBe("+3 pp");
		expect(formatPoints(-0.012)).toBe("−1 pp");
	});
});

describe("fillShare", () => {
	it("caps at 100 and handles events without a limit", () => {
		expect(fillShare(30, 60)).toBe(50);
		expect(fillShare(90, 60)).toBe(100);
		expect(fillShare(5, 0)).toBe(0);
	});
});

describe("opensLabel", () => {
	it("shows the Oslo opening date", () => {
		expect(nbsp(opensLabel(Date.parse("2026-10-04T22:30:00Z")))).toBe("Åpner 5. okt.");
	});
});

describe("defaultSelection", () => {
	it("prefers the first alert, then the first event, then nothing", () => {
		const alert = { eventId: "alert-event" };
		const event = { _id: "first-event" };
		expect(defaultSelection({ alerts: [alert], events: [event] } as unknown as UpcomingData)).toBe(
			"alert-event",
		);
		expect(defaultSelection({ alerts: [], events: [event] } as unknown as UpcomingData)).toBe(
			"first-event",
		);
		expect(defaultSelection({ alerts: [], events: [] } as unknown as UpcomingData)).toBeNull();
	});
});

describe("timeslotGrid", () => {
	it("sorts unique hours and looks up cells by weekday and hour", () => {
		const late = { weekday: 2, hour: 17, fill: 0.8, events: 2 };
		const early = { weekday: 1, hour: 12, fill: 0.4, events: 1 };
		const grid = timeslotGrid([late, early, { ...early, weekday: 3 }]);
		expect(grid.hours).toEqual([12, 17]);
		expect(grid.fillAt(2, 17)).toBe(late);
		expect(grid.fillAt(2, 12)).toBeUndefined();
	});
});

describe("followUpNote", () => {
	it("explains where unregistered students went", () => {
		const log = {
			entries: [{}, {}, {}],
			topDestination: { title: "Kodekveld", count: 2 },
			followUpMinutes: 30,
		} as unknown as UnregisterLog;
		expect(followUpNote(log)).toBe(
			"2 av 3 meldte seg på Kodekveld innen 30 minutter etter avmeldingen.",
		);
	});

	it("says nothing without a destination", () => {
		expect(
			followUpNote({ entries: [], topDestination: null } as unknown as UnregisterLog),
		).toBeNull();
	});
});

describe("lateUnregistrationNote", () => {
	it("compares with last year", () => {
		expect(lateUnregistrationNote({ current: 15, lastYear: 48 })).toBe(
			"Sene avmeldinger (under 24 t): 15 dette semesteret, 33 færre enn i fjor.",
		);
		expect(lateUnregistrationNote({ current: 9, lastYear: 4 })).toBe(
			"Sene avmeldinger (under 24 t): 9 dette semesteret, 5 flere enn i fjor.",
		);
		expect(lateUnregistrationNote({ current: 4, lastYear: 4 })).toBe(
			"Sene avmeldinger (under 24 t): 4 dette semesteret, like mange som i fjor.",
		);
	});
});

describe("alertActivity", () => {
	it("describes wave buckets in Oslo clock time", () => {
		const start = Date.parse("2026-09-26T10:10:00Z");
		const activity = alertActivity({
			rule: "unregisterWave",
			activity: [
				{ start, count: 4 },
				{ start: start + 600_000, count: 1 },
			],
		} as unknown as EngagementAlert);
		expect(activity.caption).toBe("Avmeldinger per 10 min");
		expect(activity.max).toBe(4);
		expect(activity.values[0]).toEqual({
			label: String(start),
			value: 4,
			title: "12:10: 4 avmeldinger",
		});
	});

	it("describes daily buckets and floors an empty series at zero", () => {
		const activity = alertActivity({
			rule: "behindPace",
			activity: [],
		} as unknown as EngagementAlert);
		expect(activity).toEqual({ caption: "Påmeldinger per dag", values: [], max: 0 });
	});
});

describe("cohortTints", () => {
	it("fades cohorts within each degree and keeps one series per degree", () => {
		expect(
			cohortTints([
				{ degree: "Bachelor" },
				{ degree: "Bachelor" },
				{ degree: "Bachelor" },
				{ degree: "Master" },
			]),
		).toEqual([
			{ series: 0, tint: 100 },
			{ series: 0, tint: 70 },
			{ series: 0, tint: 40 },
			{ series: 1, tint: 100 },
		]);
	});
});
