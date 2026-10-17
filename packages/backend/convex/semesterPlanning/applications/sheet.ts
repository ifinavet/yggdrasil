"use node";

import { SYSTEM_ALERTS_CHANNEL } from "@workspace/shared/slack/channels";
import { v } from "convex/values";
import { JWT } from "google-auth-library";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { type GoogleConfig, googleConfig } from "../../iam/config";
import { SHEET_HEADER } from "./sheetRow";

// Adds each received application as a row to a Google Sheet. The spreadsheet is set per
// deployment in GOOGLE_APPLICATIONS_SHEET_ID and shared with the service account as an editor;
// without it nothing is written. Values are written raw, so an answer is never read as a formula.

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const TIMEOUT_MS = 15_000;
/** How long to wait before each new try after a failure; then Navet is told in Slack. */
const RETRY_DELAYS_MS = [60_000, 10 * 60_000, 60 * 60_000];

type SheetsConfig = Readonly<{ google: GoogleConfig; spreadsheetId: string }>;

export function sheetsConfig(): SheetsConfig | null {
	const google = googleConfig();
	const spreadsheetId = process.env.GOOGLE_APPLICATIONS_SHEET_ID?.trim();
	return google && spreadsheetId ? { google, spreadsheetId } : null;
}

async function accessToken(google: GoogleConfig): Promise<string> {
	const auth = new JWT({
		email: google.serviceAccountEmail,
		key: google.privateKey,
		scopes: SCOPE,
	});
	auth.transporter.defaults.fetchImplementation = globalThis.fetch;
	auth.transporter.defaults.timeout = TIMEOUT_MS;
	try {
		const { access_token } = await auth.authorize();
		if (access_token) return access_token;
	} catch {
		// Google's error can echo the request; only our own message leaves this function.
	}
	throw new Error("Google-innloggingen for regnearket feilet.");
}

/** A tab name in A1 notation: «'Våren 2027'». */
function range(title: string): string {
	return encodeURIComponent(`'${title.replaceAll("'", "''")}'!A1`);
}

/** Adds `row` to the tab `title`, and makes the tab with a header row first if it is missing. */
export async function appendRow(
	config: SheetsConfig,
	title: string,
	row: readonly string[],
): Promise<void> {
	const token = await accessToken(config.google);
	const spreadsheet = `${SHEETS_URL}/${encodeURIComponent(config.spreadsheetId)}`;
	async function call(url: string, init: RequestInit = {}): Promise<unknown> {
		const response = await fetch(url, {
			...init,
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) throw new Error(`Google Sheets svarte ${response.status}.`);
		return response.json();
	}

	const { sheets = [] } = (await call(`${spreadsheet}?fields=sheets.properties.title`)) as {
		sheets?: { properties?: { title?: string } }[];
	};
	if (!sheets.some((sheet) => sheet.properties?.title === title)) {
		await call(`${spreadsheet}:batchUpdate`, {
			method: "POST",
			body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
		});
		await call(`${spreadsheet}/values/${range(title)}?valueInputOption=RAW`, {
			method: "PUT",
			body: JSON.stringify({ values: [SHEET_HEADER] }),
		});
	}
	await call(
		`${spreadsheet}/values/${range(title)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
		{ method: "POST", body: JSON.stringify({ values: [row] }) },
	);
}

/**
 * Adds one received application to the sheet, once. A failure is tried again later, and after the
 * last try Navet gets an alert in Slack, so a missing row is never silent.
 *
 * @param {Id<"companyApplications">} applicationId - The received application.
 * @param {number} [attempt] - How many tries have failed before this one.
 */
export const appendApplication = internalAction({
	args: { applicationId: v.id("companyApplications"), attempt: v.optional(v.number()) },
	returns: v.null(),
	handler: async (ctx, { applicationId, attempt = 0 }): Promise<null> => {
		const config = sheetsConfig();
		if (!config) return null;
		const data = await ctx.runQuery(internal.semesterPlanning.applications.sheetRow.forSheet, {
			applicationId,
		});
		if (!data || data.added) return null;

		try {
			await appendRow(config, data.title, data.row);
		} catch (error) {
			const delay = RETRY_DELAYS_MS[attempt];
			if (delay !== undefined) {
				await ctx.scheduler.runAfter(
					delay,
					internal.semesterPlanning.applications.sheet.appendApplication,
					{ applicationId, attempt: attempt + 1 },
				);
				return null;
			}
			const reason = error instanceof Error ? error.message : "Ukjent feil.";
			await ctx.scheduler.runAfter(0, internal.iam.notifications.sendMessage, {
				channel: SYSTEM_ALERTS_CHANNEL,
				clientMsgId: `bedpres-sheet-${applicationId}`,
				text: `Søknaden fra ${data.row[1]} kom ikke inn i regnearket (${data.title}). ${reason} Den ligger i Bifrost: ${data.row.at(-1)}`,
			});
			return null;
		}
		await ctx.runMutation(internal.semesterPlanning.applications.sheetRow.markAdded, {
			applicationId,
		});
		return null;
	},
});

/**
 * Adds the semester's applications that are not in the sheet yet, such as those received before
 * the sheet was set up. Run with
 * `npx convex run semesterPlanning/applications/sheet:appendMissing '{"semesterId": "…"}'`.
 *
 * @returns {number} - How many applications were queued.
 */
export const appendMissing = internalAction({
	args: { semesterId: v.id("semesters") },
	returns: v.number(),
	handler: async (ctx, { semesterId }): Promise<number> => {
		const missing = await ctx.runQuery(
			internal.semesterPlanning.applications.sheetRow.missingInSemester,
			{ semesterId },
		);
		// One after another, so the rows keep the order the applications came in.
		for (const [index, applicationId] of missing.entries()) {
			await ctx.scheduler.runAfter(
				index * 2000,
				internal.semesterPlanning.applications.sheet.appendApplication,
				{ applicationId },
			);
		}
		return missing.length;
	},
});
