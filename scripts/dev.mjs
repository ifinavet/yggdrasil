import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
	path: fileURLToPath(new URL("../.env.local", import.meta.url)),
});

const backendDir = fileURLToPath(new URL("../packages/backend", import.meta.url));
const backendEnvFile = join(backendDir, ".env.local");
const backendRequire = createRequire(new URL("../packages/backend/package.json", import.meta.url));
const convexBin = join(dirname(backendRequire.resolve("convex/package.json")), "bin/main.js");

function runConvex(args, env) {
	const result = spawnSync(process.execPath, [convexBin, ...args], {
		cwd: backendDir,
		env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		console.error(`convex ${args.join(" ")} failed with exit code ${result.status}`);
		process.exit(result.status ?? 1);
	}
}

function configuredDeployment() {
	if (!existsSync(backendEnvFile)) return "";
	return dotenv.parse(readFileSync(backendEnvFile, "utf8")).CONVEX_DEPLOYMENT ?? "";
}

if (process.env.APP_ENV === "local") {
	const localEnv = { ...process.env, CONVEX_AGENT_MODE: "anonymous", CONVEX_DEPLOYMENT: "" };
	runConvex(["init"], localEnv);
	runConvex(["env", "set", "APP_ENV", "local"], {
		...localEnv,
		CONVEX_DEPLOYMENT: configuredDeployment(),
	});
} else if (existsSync(backendEnvFile)) {
	const deployment = configuredDeployment();
	if (deployment) {
		const env = { ...process.env, CONVEX_DEPLOYMENT: deployment };
		runConvex(["env", "remove", "APP_ENV"], env);
		if (process.env.CLERK_FRONTEND_API_URL) {
			runConvex(["env", "set", "CLERK_FRONTEND_API_URL", process.env.CLERK_FRONTEND_API_URL], env);
		}
	}
}

const turboBin = fileURLToPath(new URL("../node_modules/turbo/bin/turbo", import.meta.url));
const child = spawn(process.execPath, [turboBin, "dev", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 0));
