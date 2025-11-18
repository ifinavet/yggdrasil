import type { WebhookEvent } from "@clerk/backend";
import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
	path: "/clerk-users-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const event = await validateRequest(request);
		if (!event) {
			return new Response("Error occured", { status: 400 });
		}
		switch (event.type) {
			case "user.created": // intentional fallthrough
			case "user.updated":
				await ctx.runMutation(internal.users.upsertFromClerk, {
					data: event.data,
				});
				break;

			case "user.deleted": {
				const clerkUserId = event.data.id;
				if (!clerkUserId) {
					console.error("Missing user ID in delete event");
					break;
				}
				await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
				break;
			}
			default:
				console.log("Ignored Clerk webhook event", event.type);
		}

		return new Response(null, { status: 200 });
	}),
});

http.route({
	path: "/job-listings-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const webhookSecret = process.env.JOB_LISTING_WEBHOOK_SECRET;

		if (!webhookSecret) {
			console.error("JOB_LISTING_WEBHOOK_SECRET is not configured");
			return new Response("Webhook not configured", { status: 500 });
		}

		// Verify the webhook secret from the Authorization header
		const authHeader = request.headers.get("authorization");
		const expectedAuth = `Bearer ${webhookSecret}`;

		if (authHeader !== expectedAuth) {
			console.error("Invalid webhook secret");
			return new Response("Unauthorized", { status: 401 });
		}

		try {
			const payload = await request.json();
			const { listingId, webhookUrl } = payload;

			if (!listingId || !webhookUrl) {
				return new Response("Missing required fields: listingId, webhookUrl", {
					status: 400,
				});
			}

			// Trigger the webhook notification
			await ctx.runMutation(internal.listings.notifyJobListingPublished, {
				listingId,
				webhookUrl,
			});

			return new Response(
				JSON.stringify({ success: true, listingId }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			console.error("Error processing job listing webhook:", error);
			return new Response("Internal server error", { status: 500 });
		}
	}),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
	const payloadString = await req.text();
	const svixId = req.headers.get("svix-id");
	const svixTimestamp = req.headers.get("svix-timestamp");
	const svixSignature = req.headers.get("svix-signature");
	const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

	if (!svixId || !svixTimestamp || !svixSignature || !webhookSecret) {
		console.error("Missing required webhook headers or secret");
		return null;
	}

	const svixHeaders = {
		"svix-id": svixId,
		"svix-timestamp": svixTimestamp,
		"svix-signature": svixSignature,
	};
	const wh = new Webhook(webhookSecret);
	try {
		return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
	} catch (error) {
		console.error("Error verifying webhook event", error);
		return null;
	}
}

export default http;
