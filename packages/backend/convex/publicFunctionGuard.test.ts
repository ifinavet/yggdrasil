/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const AUTHENTICATION_CALLS = [
	"requireRole(",
	"userHasRole(",
	"currentUserHasRole(",
	"isEventOrganizerOrAdmin(",
	"getCurrentUserOrThrow(",
	"getCurrentUser(",
	"getUserIdentity(",
] as const;

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
	"users/organization/queries.ts:getBoardMemberByPosition",
	"users/organization/queries.ts:getTheBoard",
];

const PUBLIC_FUNCTION_DECLARATION = /^export const (\w+) = (?:query|mutation)\(\{/gm;
const NEXT_TOP_LEVEL_EXPORT = /^export /m;

const backendSources = import.meta.glob("./**/*.ts", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;

function isBackendFunctionFile(path: string) {
	return !path.includes("/_generated/") && !path.endsWith(".test.ts");
}

function declarationBodyAfter(source: string, declarationEnd: number) {
	const rest = source.slice(declarationEnd);
	const nextExport = NEXT_TOP_LEVEL_EXPORT.exec(rest);
	return nextExport ? rest.slice(0, nextExport.index) : rest;
}

function unguardedPublicFunctions() {
	const unguarded: string[] = [];

	for (const [globPath, source] of Object.entries(backendSources)) {
		if (!isBackendFunctionFile(globPath)) continue;

		const path = globPath.replace(/^\.\//, "");
		PUBLIC_FUNCTION_DECLARATION.lastIndex = 0;

		for (
			let declaration = PUBLIC_FUNCTION_DECLARATION.exec(source);
			declaration !== null;
			declaration = PUBLIC_FUNCTION_DECLARATION.exec(source)
		) {
			const body = declarationBodyAfter(source, declaration.index + declaration[0].length);
			const isGuarded = AUTHENTICATION_CALLS.some((call) => body.includes(call));
			if (!isGuarded) unguarded.push(`${path}:${declaration[1]}`);
		}
	}

	return unguarded;
}

describe("public function guard", () => {
	it("finds the public functions to scan", () => {
		const scannedFiles = Object.keys(backendSources).filter(isBackendFunctionFile);
		expect(scannedFiles.length).toBeGreaterThan(10);
	});

	it("requires an authentication check on every public query and mutation", () => {
		expect(unguardedPublicFunctions().sort()).toEqual([...PUBLIC_READ_ONLY_FUNCTIONS].sort());
	});
});
