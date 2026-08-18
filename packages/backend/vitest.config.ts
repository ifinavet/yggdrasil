import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// convex-test runs the functions in a simulated Convex backend, which is
		// closer to the edge runtime than to Node.
		environment: "edge-runtime",
		server: { deps: { inline: ["convex-test"] } },
		include: ["convex/**/*.test.ts"],
	},
});
