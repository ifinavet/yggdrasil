"use client";

import { api } from "@workspace/backend/convex/api";
import { JOB_LISTING_ORDER_PATH } from "@workspace/shared/job-listing-orders";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { confirmCopy } from "@/lib/job-listing-order/copy";
import { useEmailLinkToken } from "@/lib/use-email-link-token";
import { OrderReceipt } from "./order-receipt";

type ConfirmResult = FunctionReturnType<typeof api.jobListingOrders.orders.confirm>;
type ConfirmState = ConfirmResult | { state: "idle" | "confirming" | "error" };

export function ConfirmOrderPage() {
	const token = useEmailLinkToken();
	if (token === undefined) return null;
	if (!token) return <LinkProblem state="invalid" />;
	return <ConfirmOrder key={token} token={token} />;
}

function ConfirmOrder({ token }: Readonly<{ token: string }>) {
	const confirm = useMutation(api.jobListingOrders.orders.confirm);
	const [result, setResult] = useState<ConfirmState>({ state: "idle" });

	const onConfirm = async () => {
		setResult({ state: "confirming" });
		try {
			setResult(await confirm({ token }));
		} catch {
			setResult({ state: "error" });
		}
	};

	if (result.state === "confirmed") return <OrderReceipt token={token} receipt={result.receipt} />;
	if (result.state === "expired" || result.state === "invalid")
		return <LinkProblem state={result.state} />;
	if (result.state === "error") {
		return (
			<div className="mx-auto w-full max-w-3xl">
				<FormStatePanel
					{...confirmCopy.error}
					action={
						<Button type="button" onClick={onConfirm}>
							{confirmCopy.retry}
						</Button>
					}
				/>
			</div>
		);
	}
	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel
				icon={<MailCheck className="size-6" />}
				title={confirmCopy.title}
				body={confirmCopy.body}
				action={
					<Button
						type="button"
						disabled={result.state === "confirming"}
						onClick={onConfirm}
						className="h-[52px] w-full rounded-[13px] font-semibold"
					>
						{result.state === "confirming" ? confirmCopy.confirming : confirmCopy.button}
					</Button>
				}
			/>
		</div>
	);
}

function LinkProblem({ state }: Readonly<{ state: "expired" | "invalid" }>) {
	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel
				{...confirmCopy[state]}
				action={
					<Button asChild>
						<Link href={JOB_LISTING_ORDER_PATH}>{confirmCopy.backToForm}</Link>
					</Button>
				}
			/>
		</div>
	);
}
