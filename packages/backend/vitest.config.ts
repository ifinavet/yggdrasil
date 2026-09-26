import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		coverage: {
			enabled: true,
			provider: "v8",
			include: [
				"convex/events/registrations/statistics.ts",
				"convex/forms/{access,mutations,queries,responses,migrations}.ts",
				"convex/feedback/forms/{helpers,mutations,queries}.ts",
				"convex/feedback/responses/{access,actions,mutations,queries}.ts",
				"convex/feedback/events.ts",
				"convex/feedback/reports/{access,build,queries,mutations,public,messages,mail}.ts",
				"convex/feedback/delivery/{campaigns,messages,mail,workflows,http}.ts",
				"convex/feedback/manualSend/{eligibility,send}.ts",
				"convex/products/{helpers,mutations,queries,seed,sales,migrations,stats,tagging}.ts",
				"convex/engagement/{alerts,audience,backfill,snapshot,log}.ts",
			],
			thresholds: { 100: true },
		},
		server: { deps: { inline: ["convex-test", "@convex-dev/workflow"] } },
		include: ["convex/**/*.test.ts"],
		env: {
			APP_ENV: "test",
			CONVEX_CLOUD_URL: "https://test-placeholder.convex.cloud",
			CLERK_WEBHOOK_SECRET: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
		},
	},
});
