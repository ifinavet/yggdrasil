"use client";

import { Button } from "@workspace/ui/components/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { useEmailLinkToken } from "@/lib/use-email-link-token";

type Panel = { readonly title: string; readonly body: string };

/** The words on the confirm page, in the feature's own nouns: «bestillingen», «søknaden». */
export type EmailLinkConfirmCopy = Panel & {
	readonly button: string;
	readonly confirming: string;
	readonly backToForm: string;
	readonly retry: string;
	/** The heading when the server refuses the confirmation and says why. */
	readonly refusedTitle?: string;
	readonly expired: Panel;
	readonly invalid: Panel;
	readonly error: Panel;
};

type ClosedLink<Receipt> =
	| { state: "confirmed"; receipt: Receipt }
	| { state: "expired" }
	| { state: "invalid" };

type TokenArgs = { token: string };

type LinkQuery = FunctionReference<
	"query",
	"public",
	TokenArgs,
	{ state: "pending" } | ClosedLink<unknown>
>;

/** The receipt a confirmed link shows, as the feature's `link` query returns it. */
type ReceiptOf<Query extends LinkQuery> = Extract<
	FunctionReturnType<Query>,
	{ state: "confirmed" }
>["receipt"];

/** The feature's link and confirm functions, its copy, and how it shows the receipt. */
type LinkProps<Query extends LinkQuery> = {
	link: Query;
	confirm: FunctionReference<
		"mutation",
		"public",
		TokenArgs,
		ClosedLink<ReceiptOf<Query>> | { state: "refused"; message: string }
	>;
	copy: EmailLinkConfirmCopy;
	receipt: (receipt: ReceiptOf<Query>, token: string) => ReactNode;
};

/**
 * Where the link in a confirmation email leads (`…/bekreft#token=…`). The company presses confirm
 * to send what it filled in to Navet; after that, the link shows the receipt.
 */
export function EmailLinkConfirmPage<Query extends LinkQuery>({
	link,
	confirm,
	copy,
	formPath,
	receipt,
}: Readonly<
	LinkProps<Query> & {
		/** The form to start over from when the link no longer works. */
		formPath: string;
	}
>) {
	const token = useEmailLinkToken();
	const backToForm = (
		<Button asChild>
			<Link href={formPath}>{copy.backToForm}</Link>
		</Button>
	);
	if (token === undefined) return null;
	if (!token) return <FormStatePanel {...copy.invalid} action={backToForm} />;
	return (
		<ConfirmLink
			key={token}
			token={token}
			link={link}
			confirm={confirm}
			copy={copy}
			backToForm={backToForm}
			receipt={receipt}
		/>
	);
}

type Attempt<Receipt> =
	| ClosedLink<Receipt>
	| { state: "refused"; message: string }
	| { state: "idle" | "confirming" | "error" };

function ConfirmLink<Query extends LinkQuery>({
	token,
	link,
	confirm,
	copy,
	backToForm,
	receipt,
}: Readonly<LinkProps<Query> & { token: string; backToForm: ReactNode }>) {
	// A generic query reference hides its argument type from `useQuery`; every link query takes the token.
	const current = useQuery(link as LinkQuery, { token }) as FunctionReturnType<Query> | undefined;
	const runConfirm = useMutation(confirm);
	const [attempt, setAttempt] = useState<Attempt<ReceiptOf<Query>>>({ state: "idle" });
	const result: Attempt<ReceiptOf<Query>> =
		attempt.state === "idle" && current && current.state !== "pending" ? current : attempt;

	const onConfirm = async () => {
		setAttempt({ state: "confirming" });
		try {
			setAttempt(await runConfirm({ token }));
		} catch {
			setAttempt({ state: "error" });
		}
	};

	if (current === undefined) return null;
	if (result.state === "confirmed") return receipt(result.receipt, token);
	if (result.state === "expired" || result.state === "invalid") {
		return <FormStatePanel {...copy[result.state]} action={backToForm} />;
	}
	if (result.state === "refused") {
		return (
			<FormStatePanel
				title={copy.refusedTitle ?? copy.error.title}
				body={result.message}
				action={backToForm}
			/>
		);
	}
	if (result.state === "error") {
		return (
			<FormStatePanel
				{...copy.error}
				action={
					<Button type="button" onClick={onConfirm}>
						{copy.retry}
					</Button>
				}
			/>
		);
	}
	return (
		<FormStatePanel
			icon={<MailCheck className="size-6" />}
			title={copy.title}
			body={copy.body}
			action={
				<Button
					type="button"
					disabled={result.state === "confirming"}
					onClick={onConfirm}
					className="h-[52px] w-full rounded-[13px] font-semibold"
				>
					{result.state === "confirming" ? copy.confirming : copy.button}
				</Button>
			}
		/>
	);
}
