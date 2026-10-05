import type { Page } from "@playwright/test";
import { api } from "@workspace/backend/convex/api";
import { ConvexHttpClient } from "convex/browser";
import { seedAdmissions } from "./seed";

export type { AdmissionSeedScenario } from "./seed";

import type { AdmissionSeedScenario } from "./seed";

function localOrigin(name: string, fallback: string) {
	const value = process.env[name] ?? fallback;
	const url = new URL(value);
	if (url.protocol !== "http:" || !new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname)) {
		throw new Error(`${name} must point to a local HTTP service, got ${url.origin}`);
	}
	return url.origin;
}

export const huginUrl = localOrigin("HUGIN_URL", "http://localhost:3023");
export const bifrostUrl = localOrigin("BIFROST_URL", "http://localhost:3021");
export const midgardUrl = localOrigin("MIDGARD_URL", "http://localhost:3020");
export const convexUrl = localOrigin("NEXT_PUBLIC_CONVEX_URL", "http://127.0.0.1:3212");
const convex = new ConvexHttpClient(convexUrl);

export async function resetAdmissions(scenario: AdmissionSeedScenario) {
	await seedAdmissions(convexUrl, scenario);
}

export async function clearCookieNotice(page: Page) {
	const rejectCookies = page.getByRole("button", { name: "Avslå bruk av cookies" });
	const cookieNoticeShown = await rejectCookies
		.waitFor({ state: "visible", timeout: 1500 })
		.then(() => true)
		.catch(() => false);
	if (cookieNoticeShown) {
		await rejectCookies.click();
		await rejectCookies.waitFor({ state: "hidden" });
	}
	const issueBadge = page.getByRole("button", { name: "Collapse issues badge" });
	if (await issueBadge.isVisible().catch(() => false)) await issueBadge.click();
}

export function admissionsOverview() {
	return convex.query(api.admissions.queries.adminOverview, {});
}
