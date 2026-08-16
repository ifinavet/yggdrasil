#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BACKEND = join(ROOT, "packages", "backend");
const APPS = ["midgard", "bifrost", "hugin"];
const KEY_ID = "yggdrasil-dev-auth";

function step(message) {
	console.log(`\n[1m${message}[0m`);
}

function run(command, args, cwd, optional = false) {
	const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });

	if (result.error) {
		if (optional) return false;
		console.error(`\nCould not run \`${command} ${args.join(" ")}\`: ${result.error.message}`);
		process.exit(1);
	}

	if (result.status !== 0) {
		if (optional) return false;
		console.error(`\n\`${command} ${args.join(" ")}\` failed with exit code ${result.status}.`);
		process.exit(1);
	}

	return true;
}

function readEnv(file) {
	const values = new Map();
	if (!existsSync(file)) return values;

	for (const line of readFileSync(file, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const separator = trimmed.indexOf("=");
		if (separator === -1) continue;

		values.set(trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim());
	}

	return values;
}

function addToEnv(file, additions) {
	const existing = readEnv(file);
	const added = Object.entries(additions).filter(([name]) => !existing.has(name));
	if (added.length === 0) return [];

	const previous = existsSync(file) ? readFileSync(file, "utf8") : "";
	const separator = previous && !previous.endsWith("\n") ? "\n" : "";
	const block = added.map(([name, value]) => `${name}=${value}`).join("\n");

	writeFileSync(file, `${previous}${separator}${block}\n`);
	return added.map(([name]) => name);
}

function keyMatchesJwks(privateJwkJson, jwksDataUrl) {
	try {
		const key = JSON.parse(privateJwkJson);
		const encoded = jwksDataUrl.slice(jwksDataUrl.indexOf(",") + 1);
		const published = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));

		return published.keys.some(
			(candidate) =>
				candidate.kty === key.kty &&
				candidate.n === key.n &&
				candidate.e === key.e &&
				candidate.kid === key.kid,
		);
	} catch {
		return false;
	}
}

function isLocalUrl(url) {
	return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(url);
}

function removeFromEnv(file, name) {
	if (!existsSync(file)) return;

	const kept = readFileSync(file, "utf8")
		.split("\n")
		.filter((line) => !line.trim().startsWith(`${name}=`));

	writeFileSync(file, kept.join("\n"));
}

function generateDevAuthKey() {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

	const shared = { kid: KEY_ID, use: "sig", alg: "RS256" };
	const jwks = { keys: [{ ...publicKey.export({ format: "jwk" }), ...shared }] };
	const privateJwk = { ...privateKey.export({ format: "jwk" }), ...shared };

	return {
		privateJwk: JSON.stringify(privateJwk),
		jwksDataUrl: `data:text/plain;charset=utf-8;base64,${Buffer.from(JSON.stringify(jwks)).toString("base64")}`,
	};
}

step("1/4  Generating a development signing key");

const backendEnvFile = join(BACKEND, ".env.local");
const existingBackendEnv = readEnv(backendEnvFile);
let { privateJwk, jwksDataUrl } = generateDevAuthKey();

const appKeys = APPS.map((app) =>
	readEnv(join(ROOT, "apps", app, ".env.local")).get("DEV_AUTH_PRIVATE_JWK"),
);
const existingJwks = existingBackendEnv.get("DEV_AUTH_JWKS");
const sharedAppKey = appKeys.every((key) => key === appKeys[0]) ? appKeys[0] : undefined;

const reusable = Boolean(
	sharedAppKey && existingJwks && keyMatchesJwks(sharedAppKey, existingJwks),
);

if (reusable) {
	privateJwk = sharedAppKey;
	jwksDataUrl = existingJwks;
	console.log("Reusing the key from a previous run.");
} else {
	if (appKeys.some(Boolean) || existingJwks) {
		console.log("Replacing signing keys that no longer agree with each other.");
		for (const app of APPS) {
			removeFromEnv(join(ROOT, "apps", app, ".env.local"), "DEV_AUTH_PRIVATE_JWK");
		}
		removeFromEnv(backendEnvFile, "DEV_AUTH_JWKS");
	}
	console.log("Generated a new RS256 key pair. It stays in .env.local and is never committed.");
}

step("2/4  Creating a local Convex deployment");
console.log(
	"If this is your first run, Convex will ask how to develop. Pick the option that runs Convex locally without an account.\n",
);
run("npx", ["convex", "dev", "--once"], BACKEND, true);

const backendEnv = readEnv(backendEnvFile);
const convexUrl = backendEnv.get("CONVEX_URL");
if (!convexUrl) {
	console.error(
		"\nConvex did not write CONVEX_URL to packages/backend/.env.local, so the deployment is not ready. Re-run this script once `npx convex dev` succeeds.",
	);
	process.exit(1);
}

if (!isLocalUrl(convexUrl)) {
	console.error(`
Refusing to continue: packages/backend/.env.local points at ${convexUrl}, which is not a local deployment.

This script disables Clerk, enables seeding and inserts demo data, none of which belong on a shared deployment. Remove CONVEX_DEPLOYMENT and CONVEX_URL from packages/backend/.env.local, then run this again and choose the local option.`);
	process.exit(1);
}
console.log(`Deployment ready at ${convexUrl}`);

step("3/4  Configuring the deployment and the apps");

addToEnv(backendEnvFile, { DEV_AUTH_JWKS: jwksDataUrl });
run("npx", ["convex", "env", "set", "DEV_AUTH_JWKS", jwksDataUrl], BACKEND);
run("npx", ["convex", "env", "set", "LOCAL_DEVELOPMENT", "true"], BACKEND);
run("npx", ["convex", "env", "set", "CLERK_FRONTEND_API_URL", ""], BACKEND);

for (const app of APPS) {
	const file = join(ROOT, "apps", app, ".env.local");
	const existing = readEnv(file);

	const existingUrl = existing.get("NEXT_PUBLIC_CONVEX_URL");
	if (existingUrl && existingUrl !== convexUrl) {
		console.log(
			`apps/${app}/.env.local: NEXT_PUBLIC_CONVEX_URL pointed at ${existingUrl}, repointing it at the local deployment`,
		);
		removeFromEnv(file, "NEXT_PUBLIC_CONVEX_URL");
	}

	const existingProvider = existing.get("NEXT_PUBLIC_AUTH_PROVIDER");
	if (existingProvider && existingProvider !== "mock") {
		console.log(
			`apps/${app}/.env.local: NEXT_PUBLIC_AUTH_PROVIDER was "${existingProvider}", switching it to mock`,
		);
		removeFromEnv(file, "NEXT_PUBLIC_AUTH_PROVIDER");
	}

	const added = addToEnv(file, {
		NEXT_PUBLIC_AUTH_PROVIDER: "mock",
		NEXT_PUBLIC_CONVEX_URL: convexUrl,
		DEV_AUTH_PRIVATE_JWK: privateJwk,
	});

	console.log(
		added.length > 0
			? `apps/${app}/.env.local: added ${added.join(", ")}`
			: `apps/${app}/.env.local: already configured, left untouched`,
	);
}

run("npx", ["convex", "dev", "--once"], BACKEND);

step("4/4  Seeding demo data");
run("npx", ["convex", "run", "seed:seedLocalDeployment"], BACKEND);

console.log(`
Done. Start everything with:

  pnpm dev

Then open http://localhost:3000 and sign in as one of the seeded users.
Ada is super-admin and can administer events in Bifrost on http://localhost:3001.
`);
