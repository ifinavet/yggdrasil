import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);
const appRequire = createRequire(new URL("../apps/midgard/package.json", import.meta.url));
const backendRequire = createRequire(new URL("../packages/backend/package.json", import.meta.url));
const convex = join(dirname(backendRequire.resolve("convex/package.json")), "bin/main.js");
const turbo = require.resolve("turbo");
const startApps = process.argv[2] === "--local-apps";
if (!startApps) {
	try {
		writeFileSync(join(root, ".env.local"), "APP_ENV=local\n", { flag: "wx" });
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
	}
	const { loadEnvConfig } = createRequire(appRequire.resolve("next/package.json"))("@next/env");
	loadEnvConfig(root, true);
}
const env = { ...process.env };
// Each Next app must still load its own environment files.
delete env.__NEXT_PROCESSED_ENV;

let child;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child?.kill(signal));
function run(entrypoint, args, cwd = root) {
	return new Promise((resolve, reject) => {
		child = spawn(process.execPath, [entrypoint, ...args], { cwd, env, stdio: "inherit" });
		child.on("error", reject);
		child.on("exit", (code) => {
			child = undefined;
			if (code === 0) resolve();
			else reject(new Error(`Development command exited with code ${code ?? 1}`));
		});
	});
}

const localDir = join(root, "packages/backend/.local-development");
if (startApps) {
	delete env.CONVEX_DEPLOYMENT;
	await run(convex, ["env", "set", "APP_ENV", "local"], localDir);
	await run(convex, ["run", "auth/local:signIn"], localDir);
	await run(turbo, [
		"dev",
		...JSON.parse(env.YGGDRASIL_DEV_ARGS),
		"--filter=!@workspace/backend",
		"--env-mode=loose",
	]);
} else if (env.APP_ENV === "local") {
	console.log(
		"Local development: Convex on 127.0.0.1:3210, mock user, email and telemetry disabled.",
	);
	Object.assign(env, {
		NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
		CONVEX_AGENT_MODE: "anonymous",
		CONVEX_DEPLOYMENT: "",
		CONVEX_DEPLOY_KEY: "",
		CONVEX_DEPLOYMENT_TOKEN: "",
		CONVEX_SELF_HOSTED_URL: "",
		CONVEX_SELF_HOSTED_ADMIN_KEY: "",
		YGGDRASIL_DEV_ARGS: JSON.stringify(process.argv.slice(2)),
	});
	mkdirSync(localDir, { recursive: true });
	copyFileSync(join(root, "packages/backend/package.json"), join(localDir, "package.json"));
	const config = JSON.parse(readFileSync(join(root, "packages/backend/convex.json"), "utf8"));
	writeFileSync(
		join(localDir, "convex.json"),
		JSON.stringify({ ...config, functions: "../convex" }),
	);
	const singleQuoteEscape = String.raw`'\''`;
	const quote = (value) =>
		process.platform === "win32" ? `"${value}"` : `'${value.replaceAll("'", singleQuoteEscape)}'`;
	await run(
		convex,
		[
			"dev",
			"--local-cloud-port",
			"3210",
			"--local-site-port",
			"3211",
			"--start",
			`${quote(process.execPath)} ${quote(script)} --local-apps`,
		],
		localDir,
	);
} else {
	await run(turbo, ["dev", ...process.argv.slice(2)]);
}
