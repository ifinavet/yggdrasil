"use client";

import { api } from "@workspace/backend/convex/api";
import { JOB_LISTING_ORDER_RECEIPT_REDIRECT_SECONDS } from "@workspace/shared/job-listing-orders";
import { formatNokFromOre } from "@workspace/shared/products";
import { convexErrorMessage } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { FieldLabel } from "@workspace/ui/components/field";
import { Note } from "@workspace/ui/components/note";
import { Textarea } from "@workspace/ui/components/textarea";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useCallback, useState } from "react";
import { receiptCopy } from "@/lib/job-listing-order/copy";
import { useRedirectCountdown } from "@/lib/use-redirect-countdown";

type Receipt = Extract<
	FunctionReturnType<typeof api.jobListingOrders.orders.confirm>,
	{ state: "confirmed" }
>["receipt"];

export function OrderReceipt({ token, receipt }: Readonly<{ token: string; receipt: Receipt }>) {
	const router = useRouter();
	const [paused, setPaused] = useState(false);
	const goHome = useCallback(() => router.replace("/"), [router]);
	const remaining = useRedirectCountdown(
		JOB_LISTING_ORDER_RECEIPT_REDIRECT_SECONDS,
		paused,
		goHome,
	);

	return (
		<div
			className="mx-auto w-full max-w-3xl pt-7 print:max-w-none print:pt-0"
			onFocusCapture={() => setPaused(true)}
		>
			<div className="fade-in zoom-in-50 mb-5 grid size-16 animate-in place-items-center rounded-full bg-success text-white duration-500 motion-reduce:animate-none print:hidden">
				<Check className="size-9" strokeWidth={3} />
			</div>
			<h1 className="m-0 mb-2 font-bold text-[20px] text-primary leading-[1.22] dark:text-primary-foreground">
				{receiptCopy.title}
			</h1>
			<p className="m-0 mb-6 text-[14.5px]">{receiptCopy.body}</p>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 rounded-xl border p-5 text-sm print:border-black">
				<ReceiptRow label={receiptCopy.reference}>
					<span className="font-mono font-semibold">{receipt.reference}</span>
				</ReceiptRow>
				<ReceiptRow label={receiptCopy.company}>{receipt.companyName}</ReceiptRow>
				<ReceiptRow label={receiptCopy.product}>{receipt.productName}</ReceiptRow>
				<ReceiptRow label={receiptCopy.quantity}>{receipt.quantity}</ReceiptRow>
				<ReceiptRow label={receiptCopy.price}>
					<span className="font-semibold">{formatNokFromOre(receipt.priceOre)}</span>
				</ReceiptRow>
				<ReceiptRow label={receiptCopy.contact}>{receipt.contactEmail}</ReceiptRow>
				<ReceiptRow label={receiptCopy.listings}>
					<ul className="m-0 flex list-none flex-col gap-1 p-0">
						{receipt.titles.map((title, index) => (
							<li key={`${index.toString()}-${title}`}>{title}</li>
						))}
					</ul>
				</ReceiptRow>
			</dl>
			{receipt.updateRequested && (
				<Note className="mt-4 print:bg-transparent print:px-0 print:text-foreground">
					{receiptCopy.updateRequested}
				</Note>
			)}
			<div className="mt-6 flex flex-wrap gap-3 print:hidden">
				<Button asChild>
					<Link href="/" replace>
						{receiptCopy.home}
					</Link>
				</Button>
				<Button type="button" variant="outline" onClick={() => window.print()}>
					<Printer className="size-4" />
					{receiptCopy.print}
				</Button>
			</div>
			{!paused && (
				<p className="mt-3 text-muted-foreground text-sm print:hidden" aria-live="off">
					{receiptCopy.redirect(remaining)}
				</p>
			)}
			{!receipt.feedbackGiven && <ReceiptFeedback token={token} />}
		</div>
	);
}

function ReceiptRow({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
	return (
		<>
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="m-0 min-w-0">{children}</dd>
		</>
	);
}

type FeedbackState =
	| { status: "idle" | "sending" | "sent" }
	| { status: "failed"; message: string };

function ReceiptFeedback({ token }: Readonly<{ token: string }>) {
	const saveFeedback = useMutation(api.jobListingOrders.orders.saveFeedback);
	const [feedback, setFeedback] = useState("");
	const [state, setState] = useState<FeedbackState>({ status: "idle" });

	if (state.status === "sent") {
		return (
			<output className="mt-8 block text-muted-foreground text-sm print:hidden">
				{receiptCopy.feedbackThanks}
			</output>
		);
	}

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!feedback.trim()) return;
		setState({ status: "sending" });
		try {
			await saveFeedback({ token, feedback: feedback.trim() });
			setState({ status: "sent" });
		} catch (error) {
			setState({
				status: "failed",
				message: convexErrorMessage(error, receiptCopy.feedbackFailed),
			});
		}
	};

	return (
		<form onSubmit={onSubmit} className="mt-10 flex flex-col gap-3 border-t pt-6 print:hidden">
			<FieldLabel htmlFor="order-feedback">{receiptCopy.feedback}</FieldLabel>
			<Textarea
				id="order-feedback"
				rows={3}
				value={feedback}
				onChange={(event) => setFeedback(event.target.value)}
			/>
			{state.status === "failed" && (
				<p role="alert" className="text-destructive text-sm">
					{state.message}
				</p>
			)}
			<Button
				type="submit"
				variant="outline"
				className="w-fit"
				disabled={state.status === "sending" || !feedback.trim()}
			>
				{state.status === "sending" ? receiptCopy.feedbackSending : receiptCopy.feedbackSubmit}
			</Button>
		</form>
	);
}
