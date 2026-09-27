import { readJson, removeItem, writeJson } from "../guarded-storage";
import { type OrderFormValues, orderFormValuesSchema } from "./form-values";

const ORDER_DRAFT_KEY = "hugin.job-listing-order.draft.v1";

const local = () => window.localStorage;

export function draftSnapshot(values: OrderFormValues): OrderFormValues {
	return { ...values, confirmAmount: false, website: "" };
}

export function parseDraft(stored: unknown): OrderFormValues | null {
	const result = orderFormValuesSchema.safeParse(stored);
	return result.success ? draftSnapshot(result.data) : null;
}

export function loadDraft(): OrderFormValues | null {
	return parseDraft(readJson(local, ORDER_DRAFT_KEY));
}

export function saveDraft(values: OrderFormValues) {
	writeJson(local, ORDER_DRAFT_KEY, draftSnapshot(values));
}

export function clearDraft() {
	removeItem(local, ORDER_DRAFT_KEY);
}
