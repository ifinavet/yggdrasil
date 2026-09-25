import { type OrderFormValues, orderFormValuesSchema } from "./form-values";

export const ORDER_DRAFT_KEY = "job-listing-order-draft";

export function serializeDraft(values: OrderFormValues): string {
	return JSON.stringify({ ...values, confirmAmount: false, website: "" });
}

export function parseDraft(raw: string | null): OrderFormValues | null {
	if (!raw) return null;
	try {
		const result = orderFormValuesSchema.safeParse(JSON.parse(raw));
		return result.success ? { ...result.data, confirmAmount: false, website: "" } : null;
	} catch {
		return null;
	}
}

export function loadDraft(): OrderFormValues | null {
	try {
		return parseDraft(localStorage.getItem(ORDER_DRAFT_KEY));
	} catch {
		return null;
	}
}

export function saveDraft(values: OrderFormValues) {
	try {
		localStorage.setItem(ORDER_DRAFT_KEY, serializeDraft(values));
	} catch {}
}

export function clearDraft() {
	try {
		localStorage.removeItem(ORDER_DRAFT_KEY);
	} catch {}
}
