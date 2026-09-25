import { EVENT_TYPE_PRICES, formatNok } from "@workspace/shared/semester/prices";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type ApplicationDraft,
	answeredCount,
	applicationSubmissionSchema,
	draftErrors,
	emptyDraft,
	firstInvalidQuestion,
	parseStudentCount,
	REQUIRED_QUESTIONS,
	toSubmission,
} from "./company-application";
import {
	billingLines,
	compactDateList,
	fullDate,
	groupDatesByMonth,
	placeName,
} from "./company-application-format";
import { loadDraft, saveDraft } from "./company-application-storage";

function completeDraft(overrides: Partial<ApplicationDraft> = {}): ApplicationDraft {
	return {
		...emptyDraft(),
		company: { orgNumber: "924773189", name: "FJORDKODE AS", organizationForm: "AS" },
		contact: { name: "Ingrid Solberg", email: "ingrid@fjordkode.no", phone: "+47 412 34 567" },
		eventType: "standard_presentation",
		students: "25–40",
		description: "Presentasjon og kodeoppgave.",
		availableDates: ["2027-01-28", "2027-02-02"],
		venue: "campus",
		foodAndDrinks: true,
		foodPurchasedBy: "company",
		wantsToUseEscape: "unsure",
		billing: { email: " faktura@fjordkode.no ", details: " PO-2027-014 " },
		consent: true,
		...overrides,
	};
}

describe("company application draft", () => {
	it("reports every required question as unanswered on an empty draft", () => {
		const errors = draftErrors(emptyDraft());
		expect(answeredCount(errors)).toBe(0);
		for (const key of REQUIRED_QUESTIONS) expect(errors[key]).toBeTruthy();
		expect(errors.additionalInfo).toBeUndefined();
		expect(firstInvalidQuestion(errors)).toBe("company");
	});

	it("accepts a complete draft and trims optional text to what the backend takes", () => {
		expect(draftErrors(completeDraft())).toEqual({});
		const form = applicationSubmissionSchema.parse(completeDraft());
		expect(form.orgNumber).toBe("924773189");
		expect(form.minStudents).toBe(25);
		expect(form.billing).toEqual({ email: "faktura@fjordkode.no", details: "PO-2027-014" });
		expect(answeredCount({})).toBe(REQUIRED_QUESTIONS.length);
	});

	it("needs a company picked from the registry", () => {
		const errors = draftErrors(completeDraft({ company: null }));
		expect(errors.company).toBe("Velg bedriften fra Enhetsregisteret.");
		expect(firstInvalidQuestion(errors)).toBe("company");
	});

	it("shows the student cap straight away, even while other answers are missing", () => {
		const errors = draftErrors({
			...emptyDraft(),
			eventType: "standard_presentation",
			students: "30-60",
		});
		expect(errors.students).toMatch(/har plass til 40/);
	});

	it.each([
		["30", { min: 30, max: 30 }],
		["20–40", { min: 20, max: 40 }],
		[" 20 - 40 ", { min: 20, max: 40 }],
		["ca 30", null],
		["", null],
	])("reads «%s» as a student count", (text, expected) => {
		expect(parseStudentCount(text)).toEqual(expected);
	});

	it("asks for a number when the student count cannot be read", () => {
		const errors = draftErrors(completeDraft({ students: "mange" }));
		expect(errors.students).toBe("Skriv et antall, for eksempel 30 eller 20–40.");
	});

	it("rejects a minimum above the maximum", () => {
		const errors = draftErrors(completeDraft({ students: "40–20" }));
		expect(errors.students).toMatch(/Minste antall/);
	});

	it("leaves food purchasing for later when there is no food", () => {
		const draft = completeDraft({ foodAndDrinks: false, foodPurchasedBy: "" });
		expect(toSubmission(draft).foodPurchasedBy).toBe("undecided");
		expect(draftErrors(draft)).toEqual({});
	});

	it("counts a missing food purchaser against the food question", () => {
		const errors = draftErrors(completeDraft({ foodAndDrinks: true, foodPurchasedBy: "" }));
		expect(errors.foodPurchasedBy).toBeTruthy();
		expect(firstInvalidQuestion(errors)).toBe("foodAndDrinks");
		expect(answeredCount(errors)).toBe(REQUIRED_QUESTIONS.length - 1);
	});

	it("requires consent and at least one date", () => {
		const errors = draftErrors(completeDraft({ consent: false, availableDates: [] }));
		expect(errors.consent).toBeTruthy();
		expect(errors.availableDates).toBe("Velg minst én dato.");
	});
});

describe("company application billing", () => {
	it("needs an invoice email or other invoice details", () => {
		const errors = draftErrors(completeDraft({ billing: { email: " ", details: "" } }));
		expect(errors.billing).toBe(
			"Skriv en e-post for faktura, eller hvordan dere vil ha fakturaen.",
		);
	});

	it("accepts only an email, or only other details", () => {
		const emailOnly = completeDraft({ billing: { email: "faktura@fjordkode.no", details: "" } });
		expect(draftErrors(emailOnly)).toEqual({});
		expect(applicationSubmissionSchema.parse(emailOnly).billing.details).toBeUndefined();

		const detailsOnly = completeDraft({ billing: { email: "", details: "EHF 924773189" } });
		expect(draftErrors(detailsOnly)).toEqual({});
		expect(applicationSubmissionSchema.parse(detailsOnly).billing.email).toBeUndefined();
	});

	it("reports an invalid invoice email under the billing question", () => {
		const errors = draftErrors(completeDraft({ billing: { email: "faktura", details: "" } }));
		expect(errors.billing).toBe("Skriv en gyldig e-postadresse for faktura.");
	});

	it("shows the email and the other details as separate receipt lines", () => {
		expect(billingLines({ email: "faktura@fjordkode.no", details: "PO-1" })).toEqual([
			"faktura@fjordkode.no",
			"PO-1",
		]);
		expect(billingLines({ details: "PO-1" })).toEqual(["PO-1"]);
	});
});

describe("company application saved draft", () => {
	const store = new Map<string, string>();

	function stubStorage() {
		store.clear();
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => store.get(key) ?? null,
				setItem: (key: string, value: string) => store.set(key, value),
				removeItem: (key: string) => store.delete(key),
			},
		});
	}

	afterEach(() => vi.unstubAllGlobals());

	it("restores a saved draft for the same semester only", () => {
		stubStorage();
		const values = completeDraft();
		saveDraft({ semesterId: "semester-1", submissionId: "submission-1", values });

		expect(loadDraft("semester-1")).toEqual({
			semesterId: "semester-1",
			submissionId: "submission-1",
			values,
		});
		expect(loadDraft("semester-2")).toBeNull();
	});

	it("falls back to unanswered for anything unreadable, and drops unknown keys", () => {
		stubStorage();
		store.set(
			"hugin.company-application.draft.v1",
			JSON.stringify({
				semesterId: "semester-1",
				submissionId: "submission-1",
				values: {
					description: "Presentasjon",
					availableDates: "2027-01-28",
					company: { name: "Uten org.nr." },
					eventType: "picnic",
					contact: { name: "Ingrid", email: 42 },
					minStudents: "20",
				},
			}),
		);

		const draft = loadDraft("semester-1");
		expect(draft?.values).toEqual({
			...emptyDraft(),
			description: "Presentasjon",
			contact: { name: "Ingrid", email: "", phone: "" },
		});
		expect(draft?.values).not.toHaveProperty("minStudents");
	});

	it("ignores a draft that is not an object", () => {
		stubStorage();
		store.set("hugin.company-application.draft.v1", "[1, 2]");
		expect(loadDraft("semester-1")).toBeNull();
	});
});

describe("company application dates", () => {
	it("groups open dates by month and ISO week", () => {
		const months = groupDatesByMonth(["2027-02-02", "2027-01-21", "2027-01-26", "2027-01-28"]);
		expect(months.map((month) => month.label)).toEqual(["Januar", "Februar"]);
		expect(months[0]?.weeks).toEqual([
			{ week: "3", days: ["2027-01-21"] },
			{ week: "4", days: ["2027-01-26", "2027-01-28"] },
		]);
	});

	it("lists chosen dates compactly, naming each month once", () => {
		expect(compactDateList(["2027-02-04", "2027-01-28", "2027-02-02", "2027-02-09"])).toBe(
			"28. jan, 2., 4. og 9. feb",
		);
		expect(compactDateList(["2027-01-28"])).toBe("28. jan");
	});

	it("writes the deadline with its year", () => {
		expect(fullDate("2026-10-15")).toBe("15. oktober 2026");
	});
});

describe("company application prices", () => {
	it("writes prices the Norwegian way, with a space between thousands", () => {
		expect(formatNok(30_000).replace(/\s/g, " ")).toBe("30 000");
	});

	it("has no price for a social event", () => {
		expect(EVENT_TYPE_PRICES.social).toBeUndefined();
		expect(EVENT_TYPE_PRICES.standard_presentation).toBe(30_000);
	});
});

describe("company application place names", () => {
	it("writes registry place names the way people do", () => {
		expect(placeName("STAVANGER")).toBe("Stavanger");
		expect(placeName("MO I RANA")).toBe("Mo i Rana");
		expect(placeName("BØ I TELEMARK")).toBe("Bø i Telemark");
		expect(placeName("ÅLESUND")).toBe("Ålesund");
	});
});
