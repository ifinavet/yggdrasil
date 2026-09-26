"use client";

import { useForm } from "@tanstack/react-form";
import type { JobListingOrderSettings } from "@workspace/shared/job-listing-orders";
import { osloToday } from "@workspace/shared/time";
import { type RefObject, useState } from "react";
import { loadDraft } from "@/lib/job-listing-order/draft";
import { emptyOrderForm, type OrderFormValues } from "@/lib/job-listing-order/form-values";
import { type OrderContext, orderFormErrors } from "@/lib/job-listing-order/submit";

export function useOrderForm({
	settings,
	context,
	onSubmit,
}: Readonly<{
	settings: JobListingOrderSettings;
	context: RefObject<OrderContext>;
	onSubmit: (values: OrderFormValues) => Promise<void>;
}>) {
	const [defaultValues] = useState(() => loadDraft() ?? emptyOrderForm());
	return useForm({
		defaultValues,
		validators: {
			onSubmit: ({ value }) => {
				const errors = orderFormErrors(value, context.current, settings, osloToday(Date.now()));
				return Object.keys(errors).length > 0 ? { fields: errors } : undefined;
			},
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}

export type OrderFormApi = ReturnType<typeof useOrderForm>;
