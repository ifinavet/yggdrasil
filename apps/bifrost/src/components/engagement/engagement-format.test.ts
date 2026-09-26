import { DATE_PATTERNS, formatOsloDate } from "@workspace/shared/time";
import { describe, expect, it } from "vitest";
import {
	alertActivity,
	attendanceRate,
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
	type PaceCurve,
	paceLabels,
	paceTickLabel,
	paceTicks,
	reachAxisMax,
	semesterLabel,
	semesterValue,
	startedSemesters,
	statusBadge,
	timeslotGrid,
	type UnregisterLog,
	type UpcomingData,
} from "./engagement-format";

const nbsp = (text: string) => text.replace(/\s/g, " ");
const nbspDate = (iso: string) => formatOsloDate(Date.parse(iso), DATE_PATTERNS.shortDate);

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
		expect(lateUnregistrationNote({ current: 15, since: null, lastYear: 48 })).toBe(
			"Sene avmeldinger (under 24 t): 15 dette semesteret, 33 færre enn i fjor.",
		);
		expect(lateUnregistrationNote({ current: 9, since: null, lastYear: 4 })).toBe(
			"Sene avmeldinger (under 24 t): 9 dette semesteret, 5 flere enn i fjor.",
		);
		expect(lateUnregistrationNote({ current: 4, since: null, lastYear: 4 })).toBe(
			"Sene avmeldinger (under 24 t): 4 dette semesteret, like mange som i fjor.",
		);
	});

	it("names when logging started and skips a comparison last year cannot support", () => {
		expect(
			nbsp(
				lateUnregistrationNote({
					current: 3,
					since: Date.parse("2026-09-10T12:00:00Z"),
					lastYear: null,
				}),
			),
		).toBe(nbsp(`Sene avmeldinger (under 24 t): 3 siden ${nbspDate("2026-09-10T12:00:00Z")}.`));
		expect(lateUnregistrationNote({ current: 2, since: null, lastYear: null })).toBe(
			"Sene avmeldinger (under 24 t): 2 dette semesteret.",
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

function curve(overrides: Partial<PaceCurve>): PaceCurve {
	return {
		title: "Bedpres",
		companyName: "Testbedrift",
		companyLogoUrl: null,
		limit: 40,
		registered: 12,
		progress: 0.5,
		projected: 30,
		typical: 35,
		baselineSize: 8,
		points: [],
		...overrides,
	};
}

describe("pace chart labels", () => {
	it("marks today only while registration is open", () => {
		expect(paceTicks(0.5)).toEqual([0, 0.5, 1]);
		expect(paceTicks(1)).toEqual([0, 1]);
		expect(paceTicks(0)).toEqual([0, 1]);
		expect([0, 0.5, 1].map((progress) => paceTickLabel({ progress: 0.5 }, progress))).toEqual([
			"Åpnet",
			"I dag",
			"Start",
		]);
		expect(paceTickLabel({ progress: 0.5 }, 0.25)).toBe("");
	});

	it("labels the current count, the prognosis and the typical outcome while open", () => {
		expect(paceLabels(curve({})).map(({ key, label }) => ({ key, label }))).toEqual([
			{ key: "actual", label: "12 nå" },
			{ key: "projected", label: "prognose 30" },
			{ key: "expected", label: "typisk 35" },
		]);
	});

	it("labels the final count once registration has closed", () => {
		expect(
			paceLabels(curve({ progress: 1, projected: null, typical: null })).map(({ label }) => label),
		).toEqual(["12 påmeldt"]);
	});

	it("leaves out the count before registration opens", () => {
		expect(
			paceLabels(curve({ progress: 0, registered: 0, projected: null })).map(({ label }) => label),
		).toEqual(["typisk 35"]);
	});
});

describe("semester options", () => {
	const semesters = [
		{ semester: "vår", year: 2026 },
		{ semester: "høst", year: 2026 },
		{ semester: "vår", year: 2027 },
	] as const;

	it("keeps started semesters, newest first", () => {
		expect(startedSemesters(semesters, Date.parse("2026-10-01T10:00:00Z"))).toEqual([
			{ semester: "høst", year: 2026 },
			{ semester: "vår", year: 2026 },
		]);
	});

	it("labels and keys a semester", () => {
		expect(semesterLabel({ semester: "høst", year: 2026 })).toBe("Høst 2026");
		expect(semesterValue({ semester: "vår", year: 2027 })).toBe("2027-vår");
	});
});

describe("attendanceRate", () => {
	it("returns the share that showed up when attendance was recorded", () => {
		expect(attendanceRate({ registered: 40, attended: 30 })).toBe(0.75);
		expect(attendanceRate({ registered: 40, attended: null })).toBeNull();
		expect(attendanceRate({ registered: 0, attended: 0 })).toBeNull();
	});
});

describe("reachAxisMax", () => {
	it("rounds the highest reach up to the next axis step", () => {
		expect(reachAxisMax([3.1, 2.4, null])).toBe(5);
		expect(reachAxisMax([4, 12])).toBe(20);
		expect(reachAxisMax([20, 36])).toBe(50);
		expect(reachAxisMax([76])).toBe(100);
	});

	it("never exceeds 100 and handles empty input", () => {
		expect(reachAxisMax([140])).toBe(100);
		expect(reachAxisMax([])).toBe(5);
		expect(reachAxisMax([null])).toBe(5);
	});
});
