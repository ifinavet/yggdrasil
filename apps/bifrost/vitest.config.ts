import { fileURLToPath } from "node:url";
import { createVitestConfig } from "@workspace/typescript-config/vitest/base";

export default createVitestConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
