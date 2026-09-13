/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import generatedApiDeclaration from "./_generated/api.d.ts?raw";

const GENERATED_MODULE_IMPORT = /^import type \* as \w+ from "\.\.\/(.+)\.js";$/gm;

const convexModules = import.meta.glob(["./**/*.{ts,tsx,js,jsx}", "!./_generated/**"], {
	query: "?raw",
	eager: true,
});

function isApiModule(globPath: string) {
	const fileName = globPath.slice(globPath.lastIndexOf("/") + 1);
	const hasSingleExtension = fileName.split(".").length === 2;
	return hasSingleExtension && !fileName.startsWith("schema.");
}

function modulesOnDisk() {
	return Object.keys(convexModules)
		.filter(isApiModule)
		.map((globPath) => globPath.replace(/^\.\//, "").replace(/\.[jt]sx?$/, ""))
		.sort();
}

function modulesInGeneratedApi() {
	return [...generatedApiDeclaration.matchAll(GENERATED_MODULE_IMPORT)]
		.map((match) => match[1])
		.sort();
}

describe("generated api", () => {
	it("lists exactly the convex modules on disk, so _generated is not stale", () => {
		expect(modulesInGeneratedApi()).toEqual(modulesOnDisk());
	});
});
