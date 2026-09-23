import { Webhook } from "svix";
import { describe, expect, it } from "vitest";
import { setup } from "../test/fixtures";

const WEBHOOK_PATH = "/clerk-users-webhook";

function clerkUserPayload(externalId: string, email: string) {
	return JSON.stringify({
		type: "user.created",
		data: {
			id: externalId,
			primary_email_address_id: "idn_primary",
			email_addresses: [{ id: "idn_primary", email_address: email }],
			first_name: "Kari",
			last_name: "Nordmann",
			image_url: "https://example.com/kari.png",
			locked: false,
		},
	});
}

function signedHeaders(body: string) {
	const id = "msg_test";
	const timestamp = new Date();
	const signature = new Webhook(process.env.CLERK_WEBHOOK_SECRET as string).sign(
		id,
		timestamp,
		body,
	);
	return {
		"svix-id": id,
		"svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
		"svix-signature": signature,
		"content-type": "application/json",
	};
}

describe("the application HTTP router", () => {
	it("mounts the Clerk webhook from convex/http.ts", async () => {
		const router = (await import("./http")).default;

		expect(router.lookup(WEBHOOK_PATH, "POST")).not.toBeNull();
	});

	it("refuses a request that is not signed by Clerk", async () => {
		const { t } = await setup();

		const response = await t.fetch(WEBHOOK_PATH, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: clerkUserPayload("user_unsigned", "usignert@example.com"),
		});

		expect(response.status).toBe(400);
	});

	it("refuses a signed request whose body was tampered with", async () => {
		const { t } = await setup();
		const headers = signedHeaders(clerkUserPayload("user_tampered", "ekte@example.com"));

		const response = await t.fetch(WEBHOOK_PATH, {
			method: "POST",
			headers,
			body: clerkUserPayload("user_tampered", "angriper@example.com"),
		});

		expect(response.status).toBe(400);
	});

	it("upserts the user from a correctly signed request", async () => {
		const { t } = await setup();
		const body = clerkUserPayload("user_signed", "signert@example.com");

		const response = await t.fetch(WEBHOOK_PATH, {
			method: "POST",
			headers: signedHeaders(body),
			body,
		});

		expect(response.status).toBe(200);
		const stored = await t.run(async (ctx) =>
			ctx.db
				.query("users")
				.withIndex("by_ExternalId", (q) => q.eq("externalId", "user_signed"))
				.first(),
		);
		expect(stored?.email).toBe("signert@example.com");
	});
});
