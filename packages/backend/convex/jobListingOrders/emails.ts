"use node";

import { Resend } from "@convex-dev/resend";
import { render } from "@react-email/render";
import JobListingOrderAdminEmail from "@workspace/emails/job-listing-order-admin-email";
import JobListingOrderConfirmEmail from "@workspace/emails/job-listing-order-confirm-email";
import JobListingOrderPublishedEmail from "@workspace/emails/job-listing-order-published-email";
import JobListingOrderReceiptEmail from "@workspace/emails/job-listing-order-receipt-email";
import JobListingOrderRejectedEmail from "@workspace/emails/job-listing-order-rejected-email";
import {
	BIFROST_LOCAL_URL,
	BIFROST_URL,
	HUGIN_LOCAL_URL,
	HUGIN_URL,
	MIDGARD_LOCAL_URL,
	MIDGARD_URL,
} from "@workspace/shared/constants";
import {
	JOB_LISTING_ORDER_CONFIRM_PATH,
	JOB_LISTING_ORDER_EMAIL,
} from "@workspace/shared/job-listing-orders";
import { formatNok } from "@workspace/shared/products";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { isLocalDevelopment } from "../auth/local";

export const orderResend: Resend = new Resend(components.resend, { testMode: false });

const orderSender = {
	from: "Navet <info@ifinavet.no>",
	replyTo: [JOB_LISTING_ORDER_EMAIL],
};

function origin(local: string, hosted: string) {
	return isLocalDevelopment() ? local : hosted;
}

export function confirmationUrl(token: string): string {
	const url = new URL(JOB_LISTING_ORDER_CONFIRM_PATH, origin(HUGIN_LOCAL_URL, HUGIN_URL));
	url.hash = new URLSearchParams({ token }).toString();
	return url.toString();
}

async function deliver(ctx: ActionCtx, to: string, subject: string, html: string) {
	if (isLocalDevelopment()) return;
	await orderResend.sendEmail(ctx, { ...orderSender, to, subject, html });
}

export async function sendConfirmationEmail(
	ctx: ActionCtx,
	{
		to,
		companyName,
		reference,
		token,
	}: Readonly<{ to: string; companyName: string; reference: string; token: string }>,
) {
	const url = confirmationUrl(token);
	if (isLocalDevelopment()) console.log(`Bekreftelseslenke for ${reference}: ${url}`);
	const html = await render(JobListingOrderConfirmEmail({ companyName, reference, url }));
	await deliver(ctx, to, `Bekreft bestillingen ${reference}`, html);
}

const orderArgs = { orderId: v.id("jobListingOrders") };

export const sendReceipt = internalAction({
	args: orderArgs,
	returns: v.null(),
	handler: async (ctx, { orderId }) => {
		const order = await ctx.runQuery(internal.jobListingOrders.orders.emailContext, { orderId });
		if (!order) return;
		const html = await render(
			JobListingOrderReceiptEmail({
				companyName: order.companyName,
				reference: order.reference,
				productName: order.productName,
				quantity: order.quantity,
				price: formatNok(order.priceOre),
				titles: order.listings.map((listing) => listing.title),
				updateRequested: order.updateRequested,
			}),
		);
		await deliver(ctx, order.contact.email, `Kvittering for bestilling ${order.reference}`, html);
	},
});

export const sendAdminNotice = internalAction({
	args: orderArgs,
	returns: v.null(),
	handler: async (ctx, { orderId }) => {
		const order = await ctx.runQuery(internal.jobListingOrders.orders.emailContext, { orderId });
		if (!order) return;
		const html = await render(
			JobListingOrderAdminEmail({
				companyName: order.companyName,
				reference: order.reference,
				quantity: order.quantity,
				price: formatNok(order.priceOre),
				updateRequested: order.updateRequested,
				reviewUrl: `${origin(BIFROST_LOCAL_URL, BIFROST_URL)}/job-listings`,
			}),
		);
		await deliver(
			ctx,
			JOB_LISTING_ORDER_EMAIL,
			`Ny bestilling ${order.reference}: ${order.companyName}`,
			html,
		);
	},
});

export const sendPublished = internalAction({
	args: orderArgs,
	returns: v.null(),
	handler: async (ctx, { orderId }) => {
		const order = await ctx.runQuery(internal.jobListingOrders.orders.emailContext, { orderId });
		if (!order) return;
		const midgard = origin(MIDGARD_LOCAL_URL, MIDGARD_URL);
		const html = await render(
			JobListingOrderPublishedEmail({
				companyName: order.companyName,
				reference: order.reference,
				listings: order.listings.map((listing) => ({
					title: listing.title,
					url: `${midgard}/job-listings/${listing.jobListingId ?? ""}`,
				})),
			}),
		);
		await deliver(ctx, order.contact.email, "Stillingsannonsene er publisert", html);
	},
});

export const sendRejected = internalAction({
	args: orderArgs,
	returns: v.null(),
	handler: async (ctx, { orderId }) => {
		const order = await ctx.runQuery(internal.jobListingOrders.orders.emailContext, { orderId });
		if (!order?.rejectionReason) return;
		const html = await render(
			JobListingOrderRejectedEmail({
				companyName: order.companyName,
				reference: order.reference,
				reason: order.rejectionReason,
			}),
		);
		await deliver(
			ctx,
			order.contact.email,
			`Bestilling ${order.reference} ble ikke publisert`,
			html,
		);
	},
});
