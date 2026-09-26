"use node";

import { isValidOrgNumber } from "@workspace/shared/semester/orgNumber";
import { SUBMISSION_ID_PATTERN } from "@workspace/shared/validation";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { generateLinkToken } from "../lib/tokens";
import { fetchBrregUnit, RegistryUnavailableError } from "../semesterPlanning/registry/client";
import {
	BLOCKED_MESSAGES,
	REGISTRY_UNAVAILABLE_MESSAGE,
} from "../semesterPlanning/registry/messages";
import { sendConfirmationEmail } from "./emails";
import { orderFormArgs, parseOrderForm } from "./orders";
import { orderRateLimiter } from "./rateLimits";

const OUTDATED_FORM_MESSAGE = "Skjemaet er utdatert. Last inn siden på nytt.";
const TOO_MANY_MESSAGE = "Det er sendt mange bestillinger på kort tid. Prøv igjen senere.";

async function registryNameFor(orgNumber: string, now: number): Promise<string> {
	if (!isValidOrgNumber(orgNumber)) throw new ConvexError("Organisasjonsnummeret er ugyldig.");
	let lookup: Awaited<ReturnType<typeof fetchBrregUnit>>;
	try {
		lookup = await fetchBrregUnit(orgNumber, now);
	} catch (error) {
		if (error instanceof RegistryUnavailableError) {
			throw new ConvexError(REGISTRY_UNAVAILABLE_MESSAGE);
		}
		throw error;
	}
	if (lookup.status === "not_found") {
		throw new ConvexError("Fant ikke bedriften i Enhetsregisteret.");
	}
	if (lookup.blockedReason) throw new ConvexError(BLOCKED_MESSAGES[lookup.blockedReason]);
	return lookup.snapshot.name;
}

export const submit = action({
	args: {
		form: orderFormArgs,
		submissionId: v.string(),
		website: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, { form, submissionId, website }) => {
		if (website?.trim()) return null;
		if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
			throw new ConvexError(OUTDATED_FORM_MESSAGE);
		}

		const now = Date.now();
		const settings = await ctx.runQuery(internal.jobListingOrders.settings.internalCurrent, {});
		const parsed = parseOrderForm(form, settings, now);

		const companyKey =
			parsed.company.kind === "existing" ? parsed.company.companyId : parsed.company.orgNumber;
		const perCompany = await orderRateLimiter.limit(ctx, "submitJobListingOrder", {
			key: companyKey,
		});
		const overall = await orderRateLimiter.limit(ctx, "submitJobListingOrderGlobal");
		if (!perCompany.ok || !overall.ok) throw new ConvexError(TOO_MANY_MESSAGE);

		const registryName =
			parsed.company.kind === "new"
				? await registryNameFor(parsed.company.orgNumber, now)
				: undefined;

		const token = generateLinkToken();
		const order = await ctx.runMutation(internal.jobListingOrders.orders.insertOrder, {
			form,
			submissionId,
			token,
			registryName,
		});
		if (order.send) {
			await sendConfirmationEmail(ctx, {
				to: order.email,
				companyName: order.companyName,
				reference: order.reference,
				token,
			});
		}
		return null;
	},
});

export const resendConfirmation = action({
	args: { submissionId: v.string() },
	returns: v.null(),
	handler: async (ctx, { submissionId }) => {
		if (!SUBMISSION_ID_PATTERN.test(submissionId)) {
			throw new ConvexError(OUTDATED_FORM_MESSAGE);
		}
		const limit = await orderRateLimiter.limit(ctx, "resendJobListingOrderConfirmation", {
			key: submissionId,
		});
		if (!limit.ok) throw new ConvexError("Vent litt før du ber om en ny e-post.");

		const token = generateLinkToken();
		const order = await ctx.runMutation(internal.jobListingOrders.orders.addConfirmationToken, {
			submissionId,
			token,
		});
		if (order) {
			await sendConfirmationEmail(ctx, {
				to: order.email,
				companyName: order.companyName,
				reference: order.reference,
				token,
			});
		}
		return null;
	},
});
