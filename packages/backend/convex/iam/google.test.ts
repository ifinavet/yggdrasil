import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { googleClient } from "./google";

const config = {
	serviceAccountEmail: "service@example.test",
	adminEmail: "admin@example.test",
	domain: "example.test",
	privateKey: "",
};
beforeAll(async () => {
	config.privateKey = await exportPKCS8(
		(await generateKeyPair("RS256", { extractable: true })).privateKey,
	);
});
afterEach(() => vi.unstubAllGlobals());

describe("Google diagnostics", () => {
	it("reports OAuth details and connection failure without echoing credentials", async () => {
		const status = vi.fn();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url, init) => {
				const assertion = new URLSearchParams(init.body).get("assertion");
				return Response.json(
					{
						error: "invalid_client",
						error_description: `Rejected ${assertion} ${config.privateKey}`,
						access_token: "never-show",
					},
					{ status: 401 },
				);
			}),
		);
		const error = await googleClient(config, status)
			.listUsers()
			.catch((error: Error) => error);
		expect(error).toBeInstanceOf(Error);
		expect(String(error)).toContain("invalid_client: Rejected [redacted] [redacted]");
		expect(String(error)).not.toContain("never-show");
		expect(status).toHaveBeenCalledWith(
			expect.stringContaining("invalid_client"),
			expect.any(Number),
		);
	});
	it.each(["<html>bad gateway</html>", "null", '{"error":42}'])(
		"retains HTTP context for malformed errors: %s",
		async (body) => {
			vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 502 })));
			await expect(googleClient(config).listUsers()).rejects.toThrow(
				"Google avviste innloggingen (502).",
			);
		},
	);
	it("clears the connection error after authentication and preserves Directory errors", async () => {
		const status = vi.fn();
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(Response.json({ access_token: "secret-token" }))
				.mockResolvedValueOnce(
					Response.json({ error: { message: "Not authorized secret-token" } }, { status: 403 }),
				),
		);
		await expect(googleClient(config, status).listUsers()).rejects.toThrow(
			"Google svarte 403 da vi skulle liste kontoene. Not authorized [redacted]",
		);
		expect(status).toHaveBeenCalledWith(undefined, expect.any(Number));
	});
});
