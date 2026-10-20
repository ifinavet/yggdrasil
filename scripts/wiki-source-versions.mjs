import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, "packages/backend/convex/wiki/sources.json");
const output = join(root, "packages/backend/convex/wiki/source-versions.json");
const sources = JSON.parse(await readFile(manifestPath, "utf8"));
async function files(path) {
	if ((await stat(join(root, path))).isFile()) return [path];
	const entries = await readdir(join(root, path), { withFileTypes: true });
	return (
		await Promise.all(
			entries
				.filter((entry) => !entry.name.startsWith(".") && !entry.name.includes(".test."))
				.map((entry) => files(`${path}/${entry.name}`)),
		)
	).flat();
}
const versions = Object.fromEntries(
	await Promise.all(
		Object.entries(sources).map(async ([slug, paths]) => {
			const hash = createHash("sha256");
			const watched = [...new Set((await Promise.all(paths.map(files))).flat())].sort((a, b) =>
				a.localeCompare(b, "en"),
			);
			const contents = await Promise.all(
				watched.map(async (path) => ({ path, contents: await readFile(join(root, path)) })),
			);
			for (const item of contents)
				hash.update(item.path).update("\0").update(item.contents).update("\0");
			return [slug, { hash: hash.digest("hex"), paths }];
		}),
	),
);
const content = `${JSON.stringify(versions, null, "\t")}\n`;
if (process.argv.includes("--check")) {
	if (JSON.stringify(versions) !== JSON.stringify(JSON.parse(await readFile(output, "utf8")))) {
		console.error(
			"Handbook source versions changed. Run node scripts/wiki-source-versions.mjs and commit the result so affected articles are flagged for review on deployment.",
		);
		process.exitCode = 1;
	}
} else await writeFile(output, content);
