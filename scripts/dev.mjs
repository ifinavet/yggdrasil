import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function parseEnvLine(line) {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith("#")) return null;
	const separator = trimmed.indexOf("=");
	if (separator === -1) return null;
	const key = trimmed.slice(0, separator).trim();
	const rawValue = trimmed.slice(separator + 1).trim();
	if (!/^[A-Za-z_]\w*$/.test(key)) return null;
	const value =
		rawValue.length >= 2 &&
		(rawValue[0] === '"' || rawValue[0] === "'") &&
		rawValue[rawValue.length - 1] === rawValue[0]
			? rawValue.slice(1, -1)
			: rawValue;
	return [key, value];
}

const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(envPath)) {
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const entry = parseEnvLine(line);
		if (!entry) continue;
		const [key, value] = entry;
		if (!(key in process.env)) {
			process.env[key] = value;
		}
	}
}

const turboBin = fileURLToPath(new URL("../node_modules/turbo/bin/turbo", import.meta.url));
const child = spawn(process.execPath, [turboBin, "dev", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
