/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const PUBLIC_FUNCTIONS_WITHOUT_AUTHENTICATION_CHECK: readonly string[] = [
	"auth/accessRights.ts:checkRights",
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
	/^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(?:query|mutation|action|httpAction)\s*\(/gm;
const ANY_BUILDER_DECLARATION = /^\s*(?:export\s+)?const\s+(\w+)\s*=\s*(\w+)\s*\(/gm;
const CUSTOM_BUILDER_FACTORY = /\bcustom(?:Query|Mutation|Action)\s*\(/;
const DEFAULT_EXPORT = /^\s*export\s+default\s/m;
const NEXT_TOP_LEVEL_DECLARATION =
	/^(?:export\s+)?(?:const|let|var|function|async\s+function|class)\b/m;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(?<!:)\/\/.*$/gm;
const IF_STATEMENT = /\bif\s*\(/g;

const THROWING_AUTHENTICATION_CALLS = ["getCurrentUserOrThrow", "requireRole"] as const;
const NON_THROWING_AUTHENTICATION_CALLS = [
	"currentUserHasRole",
	"userHasRole",
	"ctx.auth.getUserIdentity",
] as const;

function escapeForRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ASSIGNED_AUTHENTICATION_RESULT = new RegExp(
	`(?:const|let|var)\\s+(\\w+)\\s*=\\s*await\\s+(?:${NON_THROWING_AUTHENTICATION_CALLS.map(
		escapeForRegExp,
	).join("|")})\\s*\\(`,
	"g",
);

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
	const nextDeclaration = NEXT_TOP_LEVEL_DECLARATION.exec(rest);
	return nextDeclaration ? rest.slice(0, nextDeclaration.index) : rest;
}

function matchesOf(pattern: RegExp, source: string) {
	pattern.lastIndex = 0;
	const found: RegExpExecArray[] = [];

	for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
		found.push(match);
	}

	return found;
}

function balancedParenthesesFrom(code: string, openParenIndex: number) {
	let depth = 0;

	for (let index = openParenIndex; index < code.length; index++) {
		if (code[index] === "(") depth++;
		if (code[index] === ")") {
			depth--;
			if (depth === 0) return code.slice(openParenIndex + 1, index);
		}
	}

	return code.slice(openParenIndex + 1);
}

function conditionsOf(code: string) {
	return matchesOf(IF_STATEMENT, code).map((match) =>
		balancedParenthesesFrom(code, match.index + match[0].length - 1),
	);
}

function containsCallTo(code: string, calls: readonly string[]) {
	return calls.some((call) => code.includes(`${call}(`));
}

function isConsumedInCondition(code: string, conditions: readonly string[], name: string) {
	const identifier = escapeForRegExp(name);

	if (conditions.some((condition) => new RegExp(`\\b${identifier}\\b`).test(condition))) {
		return true;
	}

	return new RegExp(`!\\s*${identifier}\\b|\\b${identifier}\\s*(?:\\?(?![.?])|&&|\\|\\|)`).test(
		code,
	);
}

function assignedAuthenticationResults(code: string) {
	return matchesOf(ASSIGNED_AUTHENTICATION_RESULT, code).map((match) => match[1]);
}

function hasAuthenticationCheck(body: string) {
	const code = withoutComments(body);

	if (containsCallTo(code, THROWING_AUTHENTICATION_CALLS)) return true;

	const conditions = conditionsOf(code);
	if (conditions.some((condition) => containsCallTo(condition, NON_THROWING_AUTHENTICATION_CALLS)))
		return true;

	return assignedAuthenticationResults(code).some((name) =>
		isConsumedInCondition(code, conditions, name),
	);
}

function unguardedPublicFunctionsIn(path: string, source: string) {
	const unguarded: string[] = [];

	for (const declaration of matchesOf(PUBLIC_FUNCTION_DECLARATION, source)) {
		const body = declarationBodyAfter(source, declaration.index + declaration[0].length);
		if (!hasAuthenticationCheck(body)) unguarded.push(`${path}:${declaration[1]}`);
	}

	return unguarded;
}

function unguardedPublicFunctions() {
	return backendModules().flatMap(({ path, source }) => unguardedPublicFunctionsIn(path, source));
}

function modulesWithDefaultExport() {
	return backendModules()
		.filter(({ source }) => DEFAULT_EXPORT.test(source))
		.map(({ path }) => path);
}

function modulesUsingCustomBuilderFactories() {
	return backendModules()
		.filter(({ source }) => CUSTOM_BUILDER_FACTORY.test(withoutComments(source)))
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

function fixtureSource(handlerBody: string) {
	return [
		"export const readSecrets = query({",
		"    handler: async (ctx) => {",
		handlerBody,
		"    },",
		"});",
		"",
	].join("\n");
}

function unguardedFixtureFunctions(handlerBody: string) {
	return unguardedPublicFunctionsIn("fixture.ts", fixtureSource(handlerBody));
}

describe("public function guard", () => {
	it("finds the backend modules to scan", () => {
		expect(backendModules().length).toBeGreaterThan(10);
	});

	it("requires an authentication check on every public query and mutation", () => {
		expect(unguardedPublicFunctions().sort()).toEqual(
			[...PUBLIC_FUNCTIONS_WITHOUT_AUTHENTICATION_CHECK].sort(),
		);
	});

	it("keeps default exports to the config modules the scanner cannot read", () => {
		expect(modulesWithDefaultExport().sort()).toEqual(
			[...CONFIG_MODULES_WITH_DEFAULT_EXPORT].sort(),
		);
	});

	it("builds every function with a builder the scanner understands", () => {
		expect(functionsBuiltByUnknownBuilders()).toEqual([]);
	});

	it("never wraps builders in custom function factories the scanner cannot see through", () => {
		expect(modulesUsingCustomBuilderFactories()).toEqual([]);
	});
});

describe("public function guard scanner", () => {
	it("reports a handler that ignores the identity it looked up", () => {
		const handlerBody = [
			"        const identity = await ctx.auth.getUserIdentity();",
			'        return await ctx.db.query("users").collect();',
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual(["fixture.ts:readSecrets"]);
	});

	it("reports a handler that ignores the role result it looked up", () => {
		const handlerBody = [
			"        const isAdmin = await currentUserHasRole(ctx, adminRoles);",
			'        return await ctx.db.query("users").collect();',
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual(["fixture.ts:readSecrets"]);
	});

	it("reports a handler that only returns the role result instead of branching on it", () => {
		const handlerBody = [
			"        const isAdmin = await userHasRole(ctx, userId, adminRoles);",
			"        return isAdmin;",
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual(["fixture.ts:readSecrets"]);
	});

	it("reports a handler whose only guard sits in a comment", () => {
		const handlerBody = [
			"        // await requireRole(ctx, adminRoles);",
			'        return await ctx.db.query("users").collect();',
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual(["fixture.ts:readSecrets"]);
	});

	it("accepts a handler that branches on the role result it looked up", () => {
		const handlerBody = [
			"        const isAdmin = await currentUserHasRole(ctx, adminRoles);",
			'        if (!isAdmin) throw new ConvexError("Unauthorized");',
			'        return await ctx.db.query("users").collect();',
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual([]);
	});

	it("accepts a handler that checks the role inline in a condition", () => {
		const handlerBody = [
			"        if (!(await currentUserHasRole(ctx, adminRoles))) {",
			'            throw new ConvexError("Unauthorized");',
			"        }",
			'        return await ctx.db.query("users").collect();',
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual([]);
	});

	it("accepts a handler that calls a throwing guard", () => {
		const handlerBody = [
			"        await requireRole(ctx, adminRoles);",
			'        return await ctx.db.query("users").collect();',
		].join("\n");

		expect(unguardedFixtureFunctions(handlerBody)).toEqual([]);
	});
});
