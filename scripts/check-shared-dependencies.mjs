import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pnpmPath = process.env.npm_execpath;
assert.ok(pnpmPath && isAbsolute(pnpmPath), "Run this check with pnpm check-dependencies");
const packages = JSON.parse(
	execFileSync(pnpmPath, ["list", "-r", "--depth", "0", "--json"], {
		cwd: root,
		encoding: "utf8",
	}),
);
const dependencies = new Map();

for (const pkg of packages) {
	const manifest = JSON.parse(readFileSync(join(pkg.path, "package.json"), "utf8"));
	const installed = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies };
	for (const section of [
		"dependencies",
		"devDependencies",
		"peerDependencies",
		"optionalDependencies",
	]) {
		for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
			if (specifier.startsWith("workspace:")) continue;
			if (!dependencies.has(name)) dependencies.set(name, []);
			dependencies
				.get(name)
				.push({ package: pkg.name, specifier, version: installed[name]?.version });
		}
	}
}

let sharedCount = 0;
for (const [name, entries] of dependencies) {
	if (new Set(entries.map((entry) => entry.package)).size < 2) continue;
	sharedCount++;
	for (const entry of entries) {
		assert.equal(
			entry.specifier,
			"catalog:",
			`${entry.package}: ${name} must use the shared catalog`,
		);
		assert.ok(entry.version, `${entry.package}: ${name} is not installed`);
	}
	const versions = new Set(entries.map((entry) => entry.version));
	assert.equal(
		versions.size,
		1,
		`${name}: installed versions differ (${[...versions].join(", ")})`,
	);
}
assert.ok(sharedCount > 0, "No shared dependencies found; check workspace discovery");
console.log(
	`${sharedCount} shared dependencies use the catalog and have matching installed versions.`,
);
