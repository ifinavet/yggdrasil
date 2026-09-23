import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		server: { deps: { inline: ["convex-test"] } },
		include: ["convex/**/*.test.ts"],
		env: {
			APP_ENV: "test",
			CONVEX_CLOUD_URL: "https://test-placeholder.convex.cloud",
			CLERK_WEBHOOK_SECRET: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
		},
	},
});
