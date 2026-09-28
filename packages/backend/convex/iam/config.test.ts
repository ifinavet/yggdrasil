import { afterEach, describe, expect, it, vi } from "vitest";
import { directoriesDisabled, directoryUrl, usesFakeDirectory } from "./config";

const USERS_URL = "https://admin.googleapis.com/admin/directory/v1/users/kari%40ifinavet.no?x=1";

function runLocally() {
	vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
	vi.stubEnv("APP_ENV", "local");
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("local fake directory", () => {
	it("sends directory calls to the fake directory when running locally", () => {
		runLocally();
		vi.stubEnv("IAM_FAKE_DIRECTORY_URL", "http://127.0.0.1:3299");

		expect(directoryUrl(USERS_URL)).toBe(
			"http://127.0.0.1:3299/admin/directory/v1/users/kari%40ifinavet.no?x=1",
		);
		expect(directoriesDisabled()).toBe(false);
		expect(usesFakeDirectory()).toBe(true);
	});

	it("never redirects a deployed backend, even with the fake directory configured", () => {
		vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud");
		vi.stubEnv("APP_ENV", "local");
		vi.stubEnv("IAM_FAKE_DIRECTORY_URL", "http://127.0.0.1:3299");

		expect(directoryUrl(USERS_URL)).toBe(USERS_URL);
		expect(directoriesDisabled()).toBe(false);
		expect(usesFakeDirectory()).toBe(false);
	});

	it("keeps local development away from the real directories without a fake", () => {
		runLocally();

		expect(directoryUrl(USERS_URL)).toBe(USERS_URL);
		expect(directoriesDisabled()).toBe(true);
	});
});
