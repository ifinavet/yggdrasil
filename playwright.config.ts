import { defineConfig, devices } from "@playwright/test";

function localBaseURL(value: string | undefined, fallback: string) {
	const baseURL = new URL(value ?? fallback);
	if (
		baseURL.protocol !== "http:" ||
		!new Set(["localhost", "127.0.0.1", "[::1]"]).has(baseURL.hostname)
	) {
		throw new Error(`Admissions E2E tests only allow a local HTTP server, got ${baseURL.origin}`);
	}
	return baseURL.origin;
}

export default defineConfig({
	testDir: "./e2e/admissions",
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: "list",
	projects: [
		{
			name: "student",
			testMatch: "student*.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				// biome-ignore lint/suspicious/noUndeclaredEnvVars: Playwright runs outside Turbo.
				baseURL: localBaseURL(process.env.HUGIN_URL, "http://localhost:3023"),
			},
		},
		{
			name: "board",
			testMatch: "board*.spec.ts",
			use: {
				...devices["Desktop Chrome"],
				// biome-ignore lint/suspicious/noUndeclaredEnvVars: Playwright runs outside Turbo.
				baseURL: localBaseURL(process.env.BIFROST_URL, "http://localhost:3021"),
			},
		},
	],
	use: { trace: "retain-on-failure" },
	webServer: {
		command: "node packages/backend/test/fakeDirectory.ts",
		env: { PORT: "3299" },
		url: "http://127.0.0.1:3299/status",
		reuseExistingServer: true,
	},
});
