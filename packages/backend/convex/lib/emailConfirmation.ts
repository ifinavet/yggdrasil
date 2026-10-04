import { DAY_MS } from "@workspace/shared/time";
import { hashLinkToken, LINK_TOKEN_LENGTH } from "./tokens";

export const CONFIRMATION_TTL_MS = DAY_MS;
export async function confirmationFields(token: string, now: number) {
	return { tokenHash: await hashLinkToken(token), expiresAt: now + CONFIRMATION_TTL_MS };
}
export function confirmationState(
	confirmation: { expiresAt: number; usedAt?: number } | null,
	now: number,
) {
	if (!confirmation) return "invalid" as const;
	return !confirmation.usedAt && confirmation.expiresAt <= now
		? ("expired" as const)
		: ("valid" as const);
}
export function validEmailToken(token: string) {
	return token.length === LINK_TOKEN_LENGTH && /^[\w-]+$/.test(token);
}
