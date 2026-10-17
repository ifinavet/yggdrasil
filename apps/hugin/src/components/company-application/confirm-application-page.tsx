"use client";

import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { COMPANY_APPLICATION_COPY as COPY } from "@/lib/company-application-questions";
import { useEmailLinkToken } from "@/lib/use-email-link-token";
import { ApplicationReceipt } from "./application-receipt";

const confirmation = api.semesterPlanning.applications.confirmation;

type ConfirmResult = FunctionReturnType<typeof confirmation.confirm>;
type ConfirmState = ConfirmResult | { state: "idle" | "confirming" | "error" };

/**
 * /bestill-bedpres/bekreft#token=…: where the link in the confirmation email leads. The application
 * reaches Navet when the company presses confirm; after that the link shows the receipt.
 */
export function ConfirmApplicationPage() {
	const token = useEmailLinkToken();
	if (token === undefined) return null;
	if (!token) return <LinkProblem state="invalid" />;
	return <ConfirmApplication key={token} token={token} />;
}

function ConfirmApplication({ token }: Readonly<{ token: string }>) {
	const link = useQuery(confirmation.link, { token });
	const confirm = useMutation(confirmation.confirm);
	const [attempt, setAttempt] = useState<ConfirmState>({ state: "idle" });
	const result = attempt.state === "idle" && link && link.state !== "pending" ? link : attempt;

	const onConfirm = async () => {
		setAttempt({ state: "confirming" });
		try {
			setAttempt(await confirm({ token }));
		} catch {
			setAttempt({ state: "error" });
		}
	};

	if (link === undefined) return null;
	if (result.state === "confirmed") return <ApplicationReceipt receipt={result.receipt} />;
	if (result.state === "expired" || result.state === "invalid") {
		return <LinkProblem state={result.state} />;
	}
	if (result.state === "refused") {
		return (
			<FormStatePanel
				title={COPY.confirm.refusedTitle}
				body={result.message}
				action={<BackToForm />}
			/>
		);
	}
	if (result.state === "error") {
		return (
			<FormStatePanel
				{...COPY.confirm.error}
				action={
					<Button type="button" onClick={onConfirm}>
						{COPY.confirm.retry}
					</Button>
				}
			/>
		);
	}
	return (
		<FormStatePanel
			icon={<MailCheck className="size-6" />}
			title={COPY.confirm.title}
			body={COPY.confirm.body}
			action={
				<Button
					type="button"
					disabled={result.state === "confirming"}
					onClick={onConfirm}
					className="h-[52px] w-full rounded-[13px] font-semibold"
				>
					{result.state === "confirming" ? COPY.confirm.confirming : COPY.confirm.button}
				</Button>
			}
		/>
	);
}

function LinkProblem({ state }: Readonly<{ state: "expired" | "invalid" }>) {
	return <FormStatePanel {...COPY.confirm[state]} action={<BackToForm />} />;
}

function BackToForm() {
	return (
		<Button asChild>
			<Link href="/bestill-bedpres">{COPY.confirm.backToForm}</Link>
		</Button>
	);
}
