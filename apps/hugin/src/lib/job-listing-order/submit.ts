import type { api } from "@workspace/backend/convex/api";
import {
	companyChangesSchema,
	type JobListingOrderSettings,
	jobListingOrderSchema,
	richTextIsEmpty,
} from "@workspace/shared/job-listing-orders";
import type { FunctionArgs } from "convex/server";
import { companyCopy } from "./copy";
import type { OrderFormValues } from "./form-values";

export type OrderFormArgs = FunctionArgs<typeof api.jobListingOrders.submit.submit>["form"];

export type CompanyOnFile = Readonly<{ name: string; description: string; hasBilling: boolean }>;

export type OrderContext = Readonly<{ productId: string; companyOnFile: CompanyOnFile | null }>;

function withoutEmpty<T extends Record<string, string | undefined>>(record: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(record).filter(([, value]) => value !== undefined && value !== ""),
	) as Partial<T>;
}

export function billingRequired(values: OrderFormValues, companyOnFile: CompanyOnFile | null) {
	return values.company.kind === "new" || !companyOnFile?.hasBilling;
}

function companyChanges(values: OrderFormValues, companyOnFile: CompanyOnFile | null) {
	if (values.company.kind !== "existing" || values.companyCorrect !== "no") return undefined;
	const displayName = values.companyChanges.displayName.trim();
	const { description, logo } = values.companyChanges;
	return withoutEmpty({
		displayName: displayName === companyOnFile?.name ? undefined : displayName,
		description:
			richTextIsEmpty(description) || description === companyOnFile?.description
				? undefined
				: description,
		logo,
	});
}

export function companyChangeErrors(
	values: OrderFormValues,
	companyOnFile: CompanyOnFile | null,
): Record<string, string> {
	const result = companyChangesSchema.safeParse(companyChanges(values, companyOnFile) ?? {});
	const errors: Record<string, string> = {};
	for (const issue of result.success ? [] : result.error.issues) {
		errors[fieldPath(["companyChanges", ...issue.path])] ??= issue.message;
	}
	return errors;
}

function orderCompany({ company }: OrderFormValues): OrderFormArgs["company"] {
	if (company.kind === "existing") return { kind: "existing", companyId: company.companyId };
	return {
		kind: "new",
		orgNumber: company.orgNumber,
		displayName: company.displayName,
		description: company.description,
		logo: company.logo,
	};
}

export function toOrderForm(values: OrderFormValues, context: OrderContext): OrderFormArgs {
	const changes = companyChanges(values, context.companyOnFile);
	const sendBilling = billingRequired(values, context.companyOnFile) || values.changeBilling;
	const note = values.note.trim();
	const { name, email, phone } = values.contact;
	return {
		company: orderCompany(values),
		...(changes ? { companyChanges: changes } : {}),
		productId: context.productId,
		startup: values.startup,
		listings: values.listings,
		contact: { name, email, ...(phone.trim() ? { phone } : {}) },
		...(sendBilling ? { billing: values.billing } : {}),
		ehfInvoice: values.ehfInvoice,
		...(note ? { note } : {}),
		confirmAmount: values.confirmAmount,
	};
}

export function fieldPath(path: readonly PropertyKey[]): string {
	return path
		.map((segment, index) => {
			if (typeof segment === "number") return `[${segment}]`;
			return index === 0 ? String(segment) : `.${String(segment)}`;
		})
		.join("");
}

export function orderFormErrors(
	values: OrderFormValues,
	context: OrderContext,
	settings: JobListingOrderSettings,
	today: string,
): Record<string, string> {
	const errors: Record<string, string> = {};
	if (values.company.kind === "existing" && values.company.companyId && !values.companyCorrect) {
		errors.companyCorrect = companyCopy.answerRequired;
	}
	const result = jobListingOrderSchema(settings, today).safeParse(toOrderForm(values, context));
	for (const issue of result.success ? [] : result.error.issues) {
		const path = fieldPath(issue.path);
		errors[path] ??= issue.message;
	}
	return errors;
}
