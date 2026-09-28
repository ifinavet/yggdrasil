import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	oxc: { jsx: { runtime: "automatic" } },
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		projects: [
			{ extends: true, test: { name: "node", include: ["src/**/*.test.ts"] } },
			{
				extends: true,
				test: { name: "dom", include: ["src/**/*.test.tsx"], environment: "jsdom" },
			},
		],
	},
});
