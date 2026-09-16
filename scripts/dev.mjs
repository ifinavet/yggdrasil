import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const appRequire = createRequire(new URL("../apps/midgard/package.json", import.meta.url));
const { loadEnvConfig } = createRequire(appRequire.resolve("next/package.json"))("@next/env");
loadEnvConfig(root, true);

const env = { ...process.env };
let args = ["exec", "turbo", "dev"];
let cwd = root;
if (env.APP_ENV === "local") {
	console.log(
		"Local development: Convex on 127.0.0.1:3210, mock user, email and telemetry disabled.",
	);
	Object.assign(env, {
		NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
		CONVEX_AGENT_MODE: "anonymous",
		CONVEX_DEPLOYMENT: "",
		CONVEX_DEPLOY_KEY: "",
		CONVEX_SELF_HOSTED_URL: "",
		CONVEX_SELF_HOSTED_ADMIN_KEY: "",
	});
	cwd = `${root}/packages/backend`;
	args = [
		"exec",
		"convex",
		"dev",
		"--local-cloud-port",
		"3210",
		"--local-site-port",
		"3211",
		"--start",
		"env -u CONVEX_DEPLOYMENT pnpm exec convex env set APP_ENV local && env -u CONVEX_DEPLOYMENT pnpm exec convex run auth/local:signIn && pnpm exec turbo dev --filter=!@workspace/backend --env-mode=loose",
	];
}
const child = spawn("pnpm", args, { cwd, env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
	process.exitCode = code ?? 1;
});
