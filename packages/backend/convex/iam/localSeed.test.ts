import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setup, type TestBackend } from "../../test/fixtures";
import { internal } from "../_generated/api";

let t: TestBackend;

beforeEach(async () => {
	vi.useFakeTimers();
	({ t } = await setup());
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

function runLocally() {
	vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
	vi.stubEnv("APP_ENV", "local");
}

async function stages() {
	const accounts = await t.run((ctx) => ctx.db.query("memberAccounts").collect());
	return accounts.map((account) => account.stage).sort();
}

describe("local IAM seed", () => {
	it("covers every account stage and can be run again without duplicates", async () => {
		runLocally();

		await t.mutation(internal.iam.localSeed.seed, {});
		const first = await stages();
		await t.mutation(internal.iam.localSeed.seed, {});

		expect(new Set(first)).toEqual(
			new Set(["onboarding", "active", "offboarding", "offboarded", "cancelled"]),
		);
		expect(await stages()).toEqual(first);
	});

	it("refuses to run outside local development", async () => {
		vi.stubEnv("CONVEX_CLOUD_URL", "https://example.convex.cloud");

		await expect(t.mutation(internal.iam.localSeed.seed, {})).rejects.toThrow(
			"Lokale testdata kan bare lages lokalt.",
		);
	});
});
