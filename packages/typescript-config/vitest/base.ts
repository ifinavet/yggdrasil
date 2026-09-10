import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig, type ViteUserConfig } from "vitest/config";

const setupFile = fileURLToPath(new URL("./setup.ts", import.meta.url));

const baseConfig = defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: [setupFile],
	},
});

export function createVitestConfig(overrides: ViteUserConfig = {}) {
	return mergeConfig(baseConfig, overrides);
}
