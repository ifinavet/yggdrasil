import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		coverage: {
			enabled: true,
			provider: "v8",
			include: [
				"convex/forms/{access,mutations,queries,responses,migrations}.ts",
				"convex/feedback/forms/{helpers,mutations,queries}.ts",
				"convex/feedback/responses/{access,actions,mutations,queries}.ts",
			],
			thresholds: { 100: true },
		},
		server: { deps: { inline: ["convex-test"] } },
		include: ["convex/**/*.test.ts"],
		env: {
			APP_ENV: "test",
			CONVEX_CLOUD_URL: "https://test-placeholder.convex.cloud",
			CLERK_WEBHOOK_SECRET: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
		},
	},
});
