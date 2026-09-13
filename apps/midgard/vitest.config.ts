import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	oxc: { jsx: { runtime: "automatic" } },
	resolve: {
		alias: {
			"@workspace/ui": resolve(import.meta.dirname, "../../packages/ui/src"),
			"@": resolve(import.meta.dirname, "src"),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
