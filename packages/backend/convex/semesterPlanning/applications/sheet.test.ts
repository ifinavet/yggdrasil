import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { insertApplication, insertSemester, setup, type TestBackend } from "../../../test/fixtures";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { appendRow } from "./sheet";
import { applicationSheetRow, SHEET_HEADER } from "./sheetRow";

const sheet = internal.semesterPlanning.applications.sheet;

let privateKey = "";
beforeAll(async () => {
	privateKey = await exportPKCS8(
		(await generateKeyPair("RS256", { extractable: true })).privateKey,
	);
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

const config = () => ({
	google: {
		serviceAccountEmail: "sheets@navet.iam.gserviceaccount.com",
		privateKey,
		adminEmail: "admin@ifinavet.no",
		domain: "ifinavet.no",
	},
	spreadsheetId: "sheet-123",
});

function withSheetEnv() {
	vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL", "sheets@navet.iam.gserviceaccount.com");
	vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", privateKey);
	vi.stubEnv("GOOGLE_WORKSPACE_ADMIN_EMAIL", "admin@ifinavet.no");
	vi.stubEnv("GOOGLE_APPLICATIONS_SHEET_ID", "sheet-123");
}

type Call = { url: string; method: string; body: unknown };

/** A fake Google: the token endpoint, and a spreadsheet with the given tabs. */
function fakeGoogle({ tabs = [] as string[], failWith = 0 } = {}) {
	const calls: Call[] = [];
	const fetch = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
		const href = String(url);
		if (href.includes("oauth2.googleapis.com")) {
			return Response.json({ access_token: "sheets-token", expires_in: 3600 });
		}
		calls.push({
			url: decodeURIComponent(href),
			method: init.method ?? "GET",
			body: init.body ? JSON.parse(String(init.body)) : undefined,
		});
		if (failWith) return new Response("{}", { status: failWith });
		if (!init.method) {
			return Response.json({ sheets: tabs.map((title) => ({ properties: { title } })) });
		}
		return Response.json({});
	});
	vi.stubGlobal("fetch", fetch);
	return calls;
}

async function scheduled(t: TestBackend) {
	return t.run((ctx) => ctx.db.system.query("_scheduled_functions").take(50));
}

async function oneApplication(t: TestBackend, overrides = {}) {
	const semesterId = await insertSemester(t, { year: 2027, term: "spring" });
	const applicationId = await insertApplication(t, semesterId, overrides);
	return { semesterId, applicationId };
}

describe("applicationSheetRow", () => {
	it("lists the answers in the order of the header", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t, {
			minStudents: 30,
			maxStudents: 30,
			foodAndDrinks: false,
			additionalInfo: '=HYPERLINK("x")',
		});
		const application = await t.run((ctx) => ctx.db.get(applicationId));
		if (!application) throw new Error("Expected the application.");

		const row = applicationSheetRow(application);

		expect(row).toHaveLength(SHEET_HEADER.length);
		expect(
			Object.fromEntries(SHEET_HEADER.map((label, index) => [label, row[index]])),
		).toMatchObject({
			Bedrift: "FJORDKODE AS",
			"Org.nr.": "924773189",
			"E-post": "ingrid@fjordkode.no",
			Studenter: "30",
			Datoer: "2027-02-09, 2027-02-16",
			"Mat og drikke": "Nei",
			"Hvem kjøper": "",
			"Faktura e-post": "faktura@fjordkode.no",
			EHF: "Nei",
			Annet: '=HYPERLINK("x")',
			Bifrost: `https://bifrost.ifinavet.no/semesterplan/soknad/${applicationId}`,
		});
	});

	it("shows a range of students and who buys the food", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		const application = await t.run((ctx) => ctx.db.get(applicationId));
		if (!application) throw new Error("Expected the application.");

		const row = applicationSheetRow(application);

		expect(row[SHEET_HEADER.indexOf("Studenter")]).toBe("25–40");
		expect(row[SHEET_HEADER.indexOf("Mat og drikke")]).toBe("Ja");
		expect(row[SHEET_HEADER.indexOf("Hvem kjøper")]).not.toBe("");
	});
});

describe("appendRow", () => {
	it("makes the semester's tab with a header first, then adds the row raw", async () => {
		const calls = fakeGoogle({ tabs: ["Høsten 2026"] });

		await appendRow(config(), "Våren 2027", ["a", "=1+1"]);

		expect(calls.map(({ method, url }) => [method, url.split("sheet-123")[1]])).toEqual([
			["GET", "?fields=sheets.properties.title"],
			["POST", ":batchUpdate"],
			["PUT", "/values/'Våren 2027'!A1?valueInputOption=RAW"],
			["POST", "/values/'Våren 2027'!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"],
		]);
		expect(calls[1]?.body).toEqual({
			requests: [{ addSheet: { properties: { title: "Våren 2027" } } }],
		});
		expect(calls[2]?.body).toEqual({ values: [SHEET_HEADER] });
		expect(calls[3]?.body).toEqual({ values: [["a", "=1+1"]] });
	});

	it("only adds the row when the tab exists, and quotes an apostrophe in its name", async () => {
		const calls = fakeGoogle({ tabs: ["Navet's ark"] });

		await appendRow(config(), "Navet's ark", ["a"]);

		expect(calls.map(({ method }) => method)).toEqual(["GET", "POST"]);
		expect(calls[1]?.url).toContain("/values/'Navet''s ark'!A1:append");
	});

	it("reads a spreadsheet without tabs as one without the semester's tab", async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) => {
				calls.push(String(url));
				return String(url).includes("oauth2")
					? Response.json({ access_token: "sheets-token" })
					: Response.json({});
			}),
		);

		await appendRow(config(), "Våren 2027", ["a"]);

		expect(calls.some((url) => url.includes(":batchUpdate"))).toBe(true);
	});

	it("says which status Google answered with", async () => {
		fakeGoogle({ failWith: 403 });

		await expect(appendRow(config(), "Våren 2027", ["a"])).rejects.toThrow(
			"Google Sheets svarte 403.",
		);
	});

	it("keeps Google's login error to itself", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ error: "invalid_grant", secret: "x" }, { status: 400 })),
		);

		await expect(appendRow(config(), "Våren 2027", ["a"])).rejects.toThrow(
			"Google-innloggingen for regnearket feilet.",
		);
	});

	it("refuses a login without an access token", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ expires_in: 3600 })),
		);

		await expect(appendRow(config(), "Våren 2027", ["a"])).rejects.toThrow(
			"Google-innloggingen for regnearket feilet.",
		);
	});
});

describe("appendApplication", () => {
	it("does nothing without a spreadsheet set up", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		const calls = fakeGoogle();

		await t.action(sheet.appendApplication, { applicationId });

		expect(calls).toHaveLength(0);
	});

	it("adds the row once and remembers it", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		withSheetEnv();
		const calls = fakeGoogle({ tabs: ["Våren 2027"] });

		await t.action(sheet.appendApplication, { applicationId });
		await t.action(sheet.appendApplication, { applicationId });

		expect(calls.filter(({ url }) => url.includes(":append"))).toHaveLength(1);
		expect((await t.run((ctx) => ctx.db.get(applicationId)))?.sheetRowAddedAt).toBeTypeOf("number");
	});

	it("skips an application that is gone", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		await t.run((ctx) => ctx.db.delete(applicationId));
		withSheetEnv();
		const calls = fakeGoogle();

		await t.action(sheet.appendApplication, { applicationId });

		expect(calls).toHaveLength(0);
	});

	it("tries again later after a failure", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		withSheetEnv();
		fakeGoogle({ failWith: 500 });

		await t.action(sheet.appendApplication, { applicationId });

		const [retry] = await scheduled(t);
		expect(retry?.name).toContain("sheet:appendApplication");
		expect(retry?.args[0]).toEqual({ applicationId, attempt: 1 });
		expect((await t.run((ctx) => ctx.db.get(applicationId)))?.sheetRowAddedAt).toBeUndefined();
	});

	it("tells Navet in Slack after the last try", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		withSheetEnv();
		fakeGoogle({ failWith: 403 });

		await t.action(sheet.appendApplication, { applicationId, attempt: 3 });

		const [alert] = await scheduled(t);
		expect(alert?.name).toContain("notifications:sendMessage");
		expect(alert?.args[0].text).toBe(
			`Søknaden fra FJORDKODE AS kom ikke inn i regnearket (Våren 2027). Google Sheets svarte 403. Den ligger i Bifrost: https://bifrost.ifinavet.no/semesterplan/soknad/${applicationId}`,
		);
	});

	it("names an unknown failure in the alert", async () => {
		const { t } = await setup();
		const { applicationId } = await oneApplication(t);
		withSheetEnv();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string | URL) => {
				if (String(url).includes("oauth2")) return Response.json({ access_token: "sheets-token" });
				throw "offline";
			}),
		);

		await t.action(sheet.appendApplication, { applicationId, attempt: 3 });

		const [alert] = await scheduled(t);
		expect(alert?.args[0].text).toContain("Ukjent feil.");
	});
});

describe("appendMissing", () => {
	it("queues the semester's applications that are not in the sheet, oldest first", async () => {
		const { t } = await setup();
		const semesterId = await insertSemester(t, { status: "draft" });
		const consent = (consentedAt: number) => ({ version: "2026-10", consentedAt });
		const newer = await insertApplication(t, semesterId, { consent: consent(2000) });
		const older = await insertApplication(t, semesterId, { consent: consent(1000) });
		await insertApplication(t, semesterId, { consent: consent(500), sheetRowAddedAt: 600 });

		const queued = await t.action(sheet.appendMissing, { semesterId });

		expect(queued).toBe(2);
		const rows = (await scheduled(t)).sort((a, b) => a.scheduledTime - b.scheduledTime);
		expect(
			rows.map(
				(row) => (row.args[0] as { applicationId: Id<"companyApplications"> }).applicationId,
			),
		).toEqual([older, newer]);
	});
});
