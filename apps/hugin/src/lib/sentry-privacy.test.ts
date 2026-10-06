import * as Sentry from "@sentry/nextjs";
import { initializeSentry } from "@workspace/auth/telemetry";
import { afterEach, expect, it } from "vitest";
import { isPrivateUrl } from "./private-paths";

afterEach(async () => {
	await Sentry.close();
});

it("keeps private-page filtering active and preserves restrictive collection in Sentry 11", () => {
	initializeSentry("https://public@example.com/1", { isPrivateUrl });
	const options = Sentry.getClient()?.getOptions();
	expect(options?.traceLifecycle).toBe("static");
	expect(options?.dataCollection).toMatchObject({
		userInfo: false,
		cookies: false,
		httpBodies: [],
		genAI: { inputs: false, outputs: false },
		databaseQueryData: false,
		queues: false,
		graphQL: { document: false, variables: false },
	});
	const privateEvent = {
		request: { url: "https://hugin.ifinavet.no/report#invite=secret" },
		type: undefined,
	};
	expect(options?.beforeSend?.(privateEvent, {})).toBeNull();
	expect(options?.beforeSendTransaction?.({ ...privateEvent, type: "transaction" }, {})).toBeNull();
	const publicEvent = {
		request: { url: "https://hugin.ifinavet.no/bestill-bedpres" },
		type: undefined,
	};
	expect(options?.beforeSend?.(publicEvent, {})).toBe(publicEvent);
});
