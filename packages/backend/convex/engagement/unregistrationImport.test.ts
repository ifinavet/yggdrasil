import { DAY_MS, HOUR_MS } from "@workspace/shared/time";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	asUser,
	grantRole,
	insertEvent,
	insertRegistration,
	insertUser,
	setup,
	type TestBackend,
} from "../../test/fixtures";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { logRegistrationChange } from "./log";
import { pastCurvesBefore } from "./snapshot";

const OPENS = Date.UTC(2026, 2, 1, 10);
const START = OPENS + 10 * DAY_MS;
const REGISTERED_AT = OPENS + HOUR_MS;
const UNREGISTERED_AT = START - HOUR_MS;
const PAGE_SIZE = 1000;
const MIGRATION_BATCH_SIZE = 100;

async function pastEventOf(t: TestBackend, companyId: Id<"companies">) {
	return insertEvent(t, companyId, {
		registrationOpens: OPENS,
		eventStart: START,
		participationLimit: 2,
	});
}

async function logsFor(t: TestBackend, eventId: Id<"events">) {
	const logs = await t.run((ctx) =>
		ctx.db
			.query("registrationLog")
			.withIndex("by_eventId_and_at", (q) => q.eq("eventId", eventId))
			.collect(),
	);
	return logs.map(({ userId, change, fromStatus, at }) => ({ userId, change, fromStatus, at }));
}

function unregistration(eventId: string, userId: string, overrides = {}) {
	return {
		eventId,
		userId,
		status: "registered" as const,
		registrationTime: REGISTERED_AT,
		at: UNREGISTERED_AT,
		...overrides,
	};
}

function posthogRow(eventId: string, userId: string) {
	return [eventId, userId, "registered", REGISTERED_AT, UNREGISTERED_AT];
}

function stubPosthog(respond: (offset: number) => Response) {
	const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
		const { query } = JSON.parse(String(init?.body)) as { query: { query: string } };
		return Promise.resolve(respond(Number(/offset (\d+)$/.exec(query.query)?.[1])));
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function results(rows: unknown[]) {
	return new Response(JSON.stringify({ results: rows }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

async function internalUser(t: TestBackend) {
	const user = await insertUser(t, "intern@example.com");
	await grantRole(t, user._id, "internal");
	return asUser(t, user);
}

async function importState(t: TestBackend) {
	const current = await t.run((ctx) => ctx.db.query("unregistrationImports").first());
	return current?.state;
}

async function settle(t: TestBackend) {
	await t.finishAllScheduledFunctions(vi.runAllTimers);
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("applying imported unregistrations", () => {
	it.each([
		{
			title: "restores the registration and its unregistration",
			status: "registered",
			change: "registered",
		},
		{
			title: "keeps a waitlisted student off the seat count",
			status: "waitlist",
			change: "waitlisted",
		},
	] as const)("$title", async ({ status, change }) => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [unregistration(eventId, ada._id, { status })],
		});

		expect(await logsFor(t, eventId)).toEqual([
			{ userId: ada._id, change, fromStatus: undefined, at: REGISTERED_AT },
			{ userId: ada._id, change: "unregistered", fromStatus: status, at: UNREGISTERED_AT },
		]);
	});

	it("does not duplicate rows when the same batch is applied again", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const rows = [unregistration(eventId, ada._id)];

		await t.mutation(internal.engagement.unregistrationImport.apply, { rows });
		await t.mutation(internal.engagement.unregistrationImport.apply, { rows });

		expect(await logsFor(t, eventId)).toHaveLength(2);
	});

	it("counts a registration reported as left twice only once", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [
				unregistration(eventId, ada._id),
				unregistration(eventId, ada._id, { at: UNREGISTERED_AT + 1000 }),
			],
		});

		expect((await logsFor(t, eventId)).map(({ change, at }) => [change, at])).toEqual([
			["registered", REGISTERED_AT],
			["unregistered", UNREGISTERED_AT],
		]);
	});

	it("keeps both rounds when a student registered and unregistered twice", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [
				unregistration(eventId, ada._id, { at: OPENS + 2 * HOUR_MS }),
				unregistration(eventId, ada._id, { registrationTime: OPENS + DAY_MS }),
			],
		});

		expect((await logsFor(t, eventId)).map(({ change, at }) => [change, at])).toEqual([
			["registered", REGISTERED_AT],
			["unregistered", OPENS + 2 * HOUR_MS],
			["registered", OPENS + DAY_MS],
			["unregistered", UNREGISTERED_AT],
		]);
	});

	it("skips unknown events, deleted users and malformed ids", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const removedEvent = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const removedUser = await insertUser(t, "borte@example.com");
		await t.run(async (ctx) => {
			await ctx.db.delete(removedEvent);
			await ctx.db.delete(removedUser._id);
		});

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [
				unregistration(removedEvent, ada._id),
				unregistration(eventId, removedUser._id),
				unregistration("not-an-id", ada._id),
				unregistration(eventId, "not-an-id"),
			],
		});

		const logged = await t.run((ctx) => ctx.db.query("registrationLog").collect());
		expect(logged).toEqual([]);
	});

	it("skips rows dated outside the event's registration period", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [
				unregistration(eventId, ada._id, { registrationTime: OPENS - HOUR_MS }),
				unregistration(eventId, ada._id, { at: START + HOUR_MS }),
			],
		});

		expect(await logsFor(t, eventId)).toEqual([]);
	});

	it("leaves unregistrations the live log already covers", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const bo = await insertUser(t, "bo@example.com");
		const liveSince = Date.now();
		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: bo._id }, "registered", REGISTERED_AT),
		);

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [
				unregistration(eventId, ada._id, { at: liveSince + HOUR_MS }),
				unregistration(eventId, bo._id),
			],
		});

		expect((await logsFor(t, eventId)).map(({ userId, change }) => [userId, change])).toEqual([
			[bo._id, "registered"],
			[bo._id, "unregistered"],
		]);
	});

	it("makes the past curve dip when seats were given up before start", async () => {
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const bo = await insertUser(t, "bo@example.com");
		await t.run((ctx) =>
			logRegistrationChange(ctx, { eventId, userId: bo._id }, "registered", REGISTERED_AT),
		);

		await t.mutation(internal.engagement.unregistrationImport.apply, {
			rows: [unregistration(eventId, ada._id)],
		});

		const [past] = await t.run((ctx) => pastCurvesBefore(ctx, START + DAY_MS));
		expect(Math.max(...(past?.curve ?? []))).toBe(1);
		expect(past?.curve.at(-1)).toBe(0.5);
	});
});

describe("importing unregistrations from PostHog", () => {
	it("imports once the registration backfill is done and a key is configured", async () => {
		vi.useFakeTimers();
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
		const fetchMock = stubPosthog(() => results([]));
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		fetchMock.mockImplementation(() =>
			Promise.resolve(results([posthogRow(eventId, ada._id), ["malformed"]])),
		);
		const intern = await internalUser(t);

		expect(await intern.query(api.engagement.backfill.pending, {})).toBe(true);
		await intern.mutation(api.engagement.backfill.setup, {});
		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);
		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://eu.posthog.com/api/projects/82325/query/");
		expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer phx_test");
		expect((await logsFor(t, eventId)).map(({ change }) => change)).toEqual([
			"registered",
			"unregistered",
		]);
		expect(await intern.query(api.engagement.backfill.pending, {})).toBe(false);
		expect(await intern.query(api.engagement.backfill.importOutcome, {})).toEqual({
			state: "done",
			attempts: 1,
			imported: 2,
			error: undefined,
		});
	});

	it("runs again when an earlier revision of the import gave up", async () => {
		vi.useFakeTimers();
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const fetchMock = stubPosthog(() => results([posthogRow(eventId, ada._id)]));
		await t.run((ctx) => ctx.db.insert("unregistrationImports", { state: "failed", attempts: 3 }));
		const intern = await internalUser(t);

		expect(await intern.query(api.engagement.backfill.importOutcome, {})).toBeNull();
		expect(await intern.query(api.engagement.backfill.pending, {})).toBe(true);
		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(await logsFor(t, eventId)).toHaveLength(2);
		expect(await intern.query(api.engagement.backfill.importOutcome, {})).toMatchObject({
			state: "done",
			attempts: 1,
			imported: 2,
		});
	});

	it("waits for the registration backfill to finish before importing", async () => {
		vi.useFakeTimers();
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
		const fetchMock = stubPosthog(() => results([]));
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		for (let seat = 0; seat < MIGRATION_BATCH_SIZE + 1; seat += 1) {
			await insertRegistration(t, eventId, ada._id, "registered", REGISTERED_AT + seat);
		}
		const intern = await internalUser(t);

		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);
		expect(fetchMock).not.toHaveBeenCalled();

		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("keeps reading until a page comes back short", async () => {
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		const fetchMock = stubPosthog((offset) =>
			results(
				offset === 0
					? Array.from({ length: PAGE_SIZE }, () => posthogRow("not-an-id", ada._id))
					: [posthogRow(eventId, ada._id)],
			),
		);

		await t.action(internal.engagement.unregistrationImport.run, {});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(await logsFor(t, eventId)).toHaveLength(2);
	});

	it("keeps an unregistration whose timestamp was rounded down to the second", async () => {
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
		const { t, companyId } = await setup();
		const eventId = await pastEventOf(t, companyId);
		const ada = await insertUser(t, "ada@example.com");
		stubPosthog(() =>
			results([[eventId, ada._id, "registered", REGISTERED_AT + 400, REGISTERED_AT]]),
		);

		await t.action(internal.engagement.unregistrationImport.run, {});

		expect((await logsFor(t, eventId)).map(({ change, at }) => [change, at])).toEqual([
			["registered", REGISTERED_AT + 400],
			["unregistered", REGISTERED_AT + 400],
		]);
	});

	it("fails when PostHog answers with rows it cannot read", async () => {
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
		const { t } = await setup();
		await t.run((ctx) => ctx.db.insert("unregistrationImports", { state: "running", attempts: 1 }));
		stubPosthog(() => results([["malformed"]]));

		await expect(t.action(internal.engagement.unregistrationImport.run, {})).rejects.toThrow(
			"no readable unregistrations",
		);

		expect(await importState(t)).toBe("failed");
	});

	it("releases an attempt that never reported back", async () => {
		const { t } = await setup();
		await t.mutation(internal.engagement.unregistrationImport.expire, { attempts: 1 });
		await t.run((ctx) => ctx.db.insert("unregistrationImports", { state: "running", attempts: 2 }));

		await t.mutation(internal.engagement.unregistrationImport.expire, { attempts: 1 });
		expect(await importState(t)).toBe("running");

		await t.mutation(internal.engagement.unregistrationImport.expire, { attempts: 2 });
		expect(await t.run((ctx) => ctx.db.query("unregistrationImports").first())).toMatchObject({
			state: "failed",
			error: "The import did not report back before its deadline",
		});
	});

	it("stays idle without a key", async () => {
		vi.useFakeTimers();
		const fetchMock = stubPosthog(() => results([]));
		const { t } = await setup();
		const intern = await internalUser(t);

		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);
		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(await intern.query(api.engagement.backfill.pending, {})).toBe(false);
	});

	it("gives up after three failed attempts", async () => {
		vi.useFakeTimers();
		vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_revoked");
		const fetchMock = stubPosthog(() => new Response("{}", { status: 401 }));
		const { t } = await setup();
		const intern = await internalUser(t);

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			expect(await intern.query(api.engagement.backfill.pending, {})).toBe(true);
			await intern.mutation(api.engagement.backfill.setup, {});
			await settle(t);
		}
		await intern.mutation(api.engagement.backfill.setup, {});
		await settle(t);

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(await intern.query(api.engagement.backfill.pending, {})).toBe(false);
		expect(await intern.query(api.engagement.backfill.importOutcome, {})).toEqual({
			state: "failed",
			attempts: 3,
			imported: undefined,
			error: "Error: PostHog responded with 401",
		});
	});
});
