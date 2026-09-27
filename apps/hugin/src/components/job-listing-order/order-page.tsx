"use client";

import { api } from "@workspace/backend/convex/api";
import { Spinner } from "@workspace/ui/components/spinner";
import { useQuery } from "convex/react";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { orderPageCopy } from "@/lib/job-listing-order/copy";
import { CheckEmailScreen } from "./check-email-screen";
import { OrderForm, type SubmittedOrder } from "./order-form";

export function OrderPage() {
	const settings = useQuery(api.jobListingOrders.settings.current);
	const product = useQuery(api.jobListingOrders.form.product);
	const companies = useQuery(api.jobListingOrders.form.companies);
	const [submitted, setSubmitted] = useState<SubmittedOrder>();

	if (submitted) return <CheckEmailScreen {...submitted} />;
	if (settings === undefined || product === undefined || companies === undefined) {
		return (
			<div className="grid place-items-center pt-16">
				<Spinner />
			</div>
		);
	}
	if (!settings.open) return <StatePanel copy={orderPageCopy.closed} />;
	if (product === null) return <StatePanel copy={orderPageCopy.unavailable} />;
	return (
		<OrderForm
			settings={settings}
			product={product}
			companies={companies}
			onSubmitted={setSubmitted}
		/>
	);
}

function StatePanel({ copy }: Readonly<{ copy: { title: string; body: string } }>) {
	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel {...copy} action={null} />
		</div>
	);
}
