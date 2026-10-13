import { DAY_MS } from "@workspace/shared/time";
import { type GenericValidator, v } from "convex/values";
import { hashLinkToken, LINK_TOKEN_LENGTH } from "./tokens";

export const CONFIRMATION_TTL_MS = DAY_MS;
export async function confirmationFields(token: string, now: number) {
	return { tokenHash: await hashLinkToken(token), expiresAt: now + CONFIRMATION_TTL_MS };
}
export function confirmationState(confirmation: { expiresAt: number } | null, now: number) {
	if (!confirmation) return "invalid" as const;
	return confirmation.expiresAt <= now ? ("expired" as const) : ("valid" as const);
}
export function validEmailToken(token: string) {
	return token.length === LINK_TOKEN_LENGTH && /^[\w-]+$/.test(token);
}

/** What an emailed link answers once it can no longer be confirmed: the receipt, or why not. */
export function closedLinkStates<Receipt extends GenericValidator>(receipt: Receipt) {
	return [
		v.object({ state: v.literal("confirmed"), receipt }),
		v.object({ state: v.literal("expired") }),
		v.object({ state: v.literal("invalid") }),
	] as const;
}
