/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const PUBLIC_READ_ONLY_FUNCTIONS: readonly string[] = [
	"companies/queries.ts:getAll",
	"companies/queries.ts:getAllPaged",
	"companies/queries.ts:getById",
	"companies/queries.ts:getCompanyLogoById",
	"companies/queries.ts:getCompanyLogosPaged",
	"companies/queries.ts:getMainSponsor",
	"companies/queries.ts:searchByName",
	"events/queries.ts:getCurrentSemester",
	"events/queries.ts:getLatest",
	"events/queries.ts:getPossibleSemesters",
	"events/queries.ts:getUpcoming",
	"jobListings/queries.ts:getAllPublishedAndActive",
	"users/clerk/queries.ts:current",
	"users/organization/queries.ts:getBoardMemberByPosition",
	"users/organization/queries.ts:getTheBoard",
];

const CONFIG_MODULES_WITH_DEFAULT_EXPORT: readonly string[] = [
	"convex.config.ts",
	"crons.ts",
	"schema.ts",
	"users/clerk/http.ts",
];

const INTERNAL_FUNCTION_BUILDERS = ["internalQuery", "internalMutation", "internalAction"];

const PUBLIC_FUNCTION_DECLARATION =
	/^\s*export\s+const\s+(\w+)\s*=\s*(?:query|mutation|action|httpAction)\s*\(/gm;
const ANY_BUILDER_DECLARATION = /^\s*export\s+const\s+(\w+)\s*=\s*(\w+)\s*\(/gm;
const DEFAULT_EXPORT = /^\s*export\s+default\s/m;
const NEXT_TOP_LEVEL_EXPORT = /^export /m;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(?<!:)\/\/.*$/gm;

const AUTHENTICATION_CALLS = [
	"getCurrentUserOrThrow(",
	"requireRole(",
	"currentUserHasRole(",
	"userHasRole(",
] as const;
const IDENTITY_LOOKUP = /(?:const|let)\s+\w+\s*=\s*await\s+ctx\.auth\.getUserIdentity\(/;

const backendSources = import.meta.glob("./**/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

function isBackendFunctionFile(path: string) {
	return !path.includes("/_generated/") && !path.endsWith(".test.ts");
}

function backendModules(): Array<{ path: string; source: string }> {
	return Object.entries(backendSources)
		.filter(([globPath]) => isBackendFunctionFile(globPath))
		.map(([globPath, source]) => ({ path: globPath.replace(/^\.\//, ""), source }));
}

function withoutComments(source: string) {
	return source.replace(BLOCK_COMMENT, "").replace(LINE_COMMENT, "");
}

function declarationBodyAfter(source: string, declarationEnd: number) {
	const rest = source.slice(declarationEnd);
	const nextExport = NEXT_TOP_LEVEL_EXPORT.exec(rest);
	return nextExport ? rest.slice(0, nextExport.index) : rest;
}

function matchesOf(pattern: RegExp, source: string) {
	pattern.lastIndex = 0;
	const found: RegExpExecArray[] = [];

	for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
		found.push(match);
	}

	return found;
}

function hasAuthenticationCheck(body: string) {
	const code = withoutComments(body);
	return AUTHENTICATION_CALLS.some((call) => code.includes(call)) || IDENTITY_LOOKUP.test(code);
}

function unguardedPublicFunctions() {
	const unguarded: string[] = [];

	for (const { path, source } of backendModules()) {
		for (const declaration of matchesOf(PUBLIC_FUNCTION_DECLARATION, source)) {
			const body = declarationBodyAfter(source, declaration.index + declaration[0].length);
			if (!hasAuthenticationCheck(body)) unguarded.push(`${path}:${declaration[1]}`);
		}
	}

	return unguarded;
}

function modulesWithDefaultExport() {
	return backendModules()
		.filter(({ source }) => DEFAULT_EXPORT.test(source))
		.map(({ path }) => path);
}

function functionsBuiltByUnknownBuilders() {
	const unknown: string[] = [];

	for (const { path, source } of backendModules()) {
		for (const [, name, builder] of matchesOf(ANY_BUILDER_DECLARATION, source)) {
			if (!/(?:Query|Mutation|Action)$/.test(builder)) continue;
			if (INTERNAL_FUNCTION_BUILDERS.includes(builder)) continue;

			unknown.push(`${path}:${name} built by ${builder}`);
		}
	}

	return unknown;
}

describe("public function guard", () => {
	it("finds the backend modules to scan", () => {
		expect(backendModules().length).toBeGreaterThan(10);
	});

	it("requires an authentication check on every public query and mutation", () => {
		expect(unguardedPublicFunctions().sort()).toEqual([...PUBLIC_READ_ONLY_FUNCTIONS].sort());
	});

	it("keeps default exports to the config modules the scanner cannot read", () => {
		expect(modulesWithDefaultExport().sort()).toEqual(
			[...CONFIG_MODULES_WITH_DEFAULT_EXPORT].sort(),
		);
	});

	it("builds every exported function with a builder the scanner understands", () => {
		expect(functionsBuiltByUnknownBuilders()).toEqual([]);
	});
});
