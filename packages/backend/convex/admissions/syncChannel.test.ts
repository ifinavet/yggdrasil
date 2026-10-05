import { afterEach, expect, it, vi } from "vitest";
import { applicationFields, interviewFields, periodFields } from "../../test/admissions-fixtures";
import {
	allOperations,
	deliveryContext,
	operationArgs,
	stageOperation,
} from "../../test/admissions-workflow";
import { asUser, grantRole, insertUser, setup } from "../../test/fixtures";
import { api, internal } from "../_generated/api";

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.SLACK_BOT_TOKEN;
	delete process.env.CONVEX_CLOUD_URL;
	delete process.env.APP_ENV;
});

it("reconciles Slack membership as soon as interviewer selection changes", async () => {
	process.env.SLACK_BOT_TOKEN = "test-token";
	const calls: Array<{ method: string; params: URLSearchParams }> = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const method = String(input).split("/").at(-1) ?? "";
			const params = new URLSearchParams(String(init?.body ?? ""));
			calls.push({ method, params });
			if (method === "conversations.create")
				return Response.json({ ok: true, channel: { id: "C-admissions" } });
			if (method === "conversations.info")
				return Response.json({
					ok: true,
					channel: { name: "h26-opptak", is_private: true, purpose: { value: "admissions" } },
				});
			if (method === "auth.test") return Response.json({ ok: true, user_id: "U-bot" });
			if (method === "users.lookupByEmail")
				return Response.json({ ok: true, user: { id: `U-${params.get("email")}` } });
			if (method === "conversations.members")
				return Response.json({
					ok: true,
					members: ["U-bot", "U-old@ifinavet.no", "U-stay@ifinavet.no", "U-manual"],
				});
			return Response.json({ ok: true });
		}),
	);

	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	await grantRole(t, admin._id, "admin");
	const old = await insertUser(t, "old@ifinavet.no");
	const staying = await insertUser(t, "stay@ifinavet.no");
	const added = await insertUser(t, "new@ifinavet.no");
	const alsoStaying = await insertUser(t, "also-stay@ifinavet.no");
	await Promise.all(
		[old, staying, added, alsoStaying].map((user) => grantRole(t, user._id, "internal")),
	);
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				revision: 1,
				interviewers: [old, staying, alsoStaying].map(({ _id }) => ({
					userId: _id,
					selectedCalendarIds: ["primary"],
				})),
				slackManagedMemberIds: ["U-old@ifinavet.no"],
			}),
		),
	);
	await asUser(t, admin).mutation(api.admissions.board.updateInterviewers, {
		periodId,
		expectedRevision: 1,
		interviewers: [staying, added, alsoStaying].map(({ _id }) => ({
			userId: _id,
			selectedCalendarIds: ["primary"],
		})),
	});
	const job = await t.run((ctx) => allOperations(ctx).then((jobs) => jobs[0]));
	expect(job).toMatchObject({ kind: "sync_channel", state: "inProgress", revision: 2 });
	await t.action(internal.admissions.actions.execute, {
		operation: await operationArgs(t, job?.idempotencyKey ?? ""),
	});

	expect(calls.find((call) => call.method === "conversations.kick")?.params.get("user")).toBe(
		"U-old@ifinavet.no",
	);
	expect(calls.find((call) => call.method === "conversations.invite")?.params.get("users")).toBe(
		"U-new@ifinavet.no",
	);
	expect(
		calls.some(
			(call) => call.method === "conversations.kick" && call.params.get("user") === "U-manual",
		),
	).toBe(false);
	expect(await t.run((ctx) => ctx.db.get(periodId))).toMatchObject({
		slackManagedMemberIds: ["U-stay@ifinavet.no", "U-new@ifinavet.no", "U-also-stay@ifinavet.no"],
	});
});

it("keeps full selected interviewer membership separate from an interview's assigned pair", async () => {
	const { t } = await setup();
	const admin = await insertUser(t, "admin@example.test");
	const candidate = await insertUser(t, "candidate@uio.no");
	const selected = await Promise.all(
		["one", "two", "three"].map((name) => insertUser(t, `${name}@ifinavet.no`)),
	);
	await Promise.all(selected.map((user) => grantRole(t, user._id, "internal")));
	const periodId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionPeriods",
			periodFields(admin._id, {
				status: "published",
				interviewers: selected.map(({ _id }) => ({
					userId: _id,
					selectedCalendarIds: ["primary"],
				})),
			}),
		),
	);
	const applicationId = await t.run((ctx) =>
		ctx.db.insert("admissionApplications", applicationFields(periodId, candidate._id)),
	);
	const interviewId = await t.run((ctx) =>
		ctx.db.insert(
			"admissionInterviews",
			interviewFields(periodId, applicationId, {
				interviewerIds: selected.slice(0, 2).map(({ _id }) => _id),
			}),
		),
	);
	await t.run((ctx) =>
		stageOperation(ctx, {
			kind: "publish",
			periodId,
			applicationId,
			interviewId,
			revision: 1,
			idempotencyKey: `publish:${interviewId}:1`,
			state: "inProgress",
			dueAt: Date.now(),
		}),
	);
	const claimed = await deliveryContext(t, `publish:${interviewId}:1`);
	expect(claimed?.interviewers).toHaveLength(2);
	expect(claimed?.selectedInterviewers).toHaveLength(3);
});
