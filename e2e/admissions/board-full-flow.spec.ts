import { expect, test } from "@playwright/test";
import {
	admissionsOverview,
	bifrostUrl,
	clearCookieNotice,
	fakeDirectoryState,
	fakeDirectoryUrl,
	huginUrl,
	internalMembers,
	resetAdmissions,
} from "./production-helpers";

const KRISTIN = "kristin.berg@ifinavet.no";

async function blockCalendar(subject: string, start: number, end: number) {
	const response = await fetch(`${fakeDirectoryUrl}/calendar/v3/calendars/navet/events`, {
		method: "POST",
		headers: { Authorization: `Bearer fake-google:${subject}`, "Content-Type": "application/json" },
		body: JSON.stringify({
			id: `busy${start}`,
			summary: "Forelesning",
			start: { dateTime: new Date(start).toISOString() },
			end: { dateTime: new Date(end).toISOString() },
		}),
	});
	expect(response.status).toBe(200);
}

test.describe("full admission flow against fake Google and Slack", () => {
	test.describe.configure({ mode: "serial", timeout: 120_000 });

	test("suggests times around busy calendars and publishes them as calendar events", async ({
		page,
	}) => {
		await resetAdmissions("open");
		const seeded = await admissionsOverview();
		const period = seeded?.period;
		expect(period).toBeDefined();
		const busyStart = period?.interviewStartAt ?? 0;
		const busyEnd = busyStart + 3 * 24 * 60 * 60_000;
		await blockCalendar(KRISTIN, busyStart, busyEnd);

		await page.goto(`${bifrostUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: "Finn tider", exact: true }).click();
		await expect
			.poll(async () => (await admissionsOverview())?.interviews.length)
			.toBeGreaterThan(0);
		const overview = await admissionsOverview();
		const kristin = overview?.interviewers.find((person) => person.email === KRISTIN);
		expect(kristin).toBeDefined();
		const kristinsInterviews = (overview?.interviews ?? []).filter((interview) =>
			interview.interviewerIds.includes(kristin?.id ?? ""),
		);
		expect(kristinsInterviews.length).toBeGreaterThan(0);
		for (const interview of overview?.interviews ?? []) {
			if (interview.interviewerIds.includes(kristin?.id ?? ""))
				expect(interview.endAt <= busyStart || busyEnd <= interview.startAt).toBe(true);
		}

		await page.getByRole("button", { name: "Godkjenn forslag", exact: true }).click();
		await expect(
			page.getByText("Intervjuplanen er klar for utsending", { exact: true }),
		).toBeVisible();
		await expect
			.poll(
				async () =>
					(await admissionsOverview())?.interviews.every(
						(interview) => interview.publishedAt !== undefined,
					),
				{ timeout: 60_000 },
			)
			.toBe(true);
		const published = (await admissionsOverview())?.interviews ?? [];
		const state = await fakeDirectoryState();
		const events = Object.values(state.calendarEvents)
			.flat()
			.filter((event) => event.status !== "cancelled" && !event.id.startsWith("busy"));
		expect(events).toHaveLength(published.length);
		const channel = state.slackChannels.find((entry) => entry.name.endsWith("-opptak"));
		expect(channel?.members).toEqual(expect.arrayContaining(["U011", "U012"]));
	});

	test("an accepted offer provisions the member account in Google Workspace", async ({ page }) => {
		await resetAdmissions("decisions");
		expect((await fakeDirectoryState()).google["developer@ifinavet.no"]).toBeUndefined();
		expect(await internalMembers()).toHaveLength(0);

		await page.goto(`${huginUrl}/admissions`);
		await clearCookieNotice(page);
		await page.getByRole("button", { name: "Takk ja", exact: true }).click();
		await page.getByRole("button", { name: "Bekreft at jeg takker ja" }).click();
		await expect(page.getByText("Du har takket ja til plassen")).toBeVisible();

		await expect
			.poll(async () => (await fakeDirectoryState()).google["developer@ifinavet.no"], {
				timeout: 60_000,
			})
			.toBeDefined();
		await expect
			.poll(async () => (await internalMembers())[0]?.connections, { timeout: 60_000 })
			.toMatchObject({ google: "created", uioEmail: "developer@uio.no", welcomeSent: true });
		expect(await internalMembers()).toEqual([
			expect.objectContaining({ email: "developer@uio.no", group: "Web" }),
		]);
	});
});
