import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(envPath)) {
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		if (!line.trim() || line.trimStart().startsWith("#")) continue;
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
		if (!match) continue;
		const [, key, rawValue] = match;
		if (!(key in process.env)) {
			process.env[key] = rawValue.replace(/^["'](.*)["']$/, "$1");
		}
	}
}

const turboBin = fileURLToPath(new URL("../node_modules/turbo/bin/turbo", import.meta.url));
const child = spawn(process.execPath, [turboBin, "dev", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
