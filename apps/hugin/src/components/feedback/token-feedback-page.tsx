"use client";

import { api } from "@workspace/backend/convex/api";
import { MIDGARD_URL } from "@workspace/shared/constants";
import { Button } from "@workspace/ui/components/button";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { feedbackCopy, feedbackStateCopy } from "@/lib/feedback/copy";
import { readFeedbackToken } from "@/lib/feedback/form";
import { type FeedbackCredential, TokenFeedbackForm } from "./token-feedback-form";

function subscribeToLink(onChange: () => void) {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
}
export function TokenFeedbackPage() {
	const [attempt, setAttempt] = useState(0);
	const fragment = useSyncExternalStore(
		subscribeToLink,
		() => window.location.hash,
		() => "",
	);
	const token = readFeedbackToken(fragment);
	const credential = useMemo(() => (token ? { token } : null), [token]);
	return (
		<FeedbackInvitation
			key={`${fragment}:${attempt}`}
			credential={credential}
			onRetry={() => setAttempt(attempt + 1)}
		/>
	);
}
export function InviteFeedbackPage({ inviteId }: Readonly<{ inviteId: string }>) {
	const [attempt, setAttempt] = useState(0);
	const credential = useMemo(() => ({ inviteId }), [inviteId]);
	return (
		<FeedbackInvitation
			key={`${inviteId}:${attempt}`}
			credential={credential}
			onRetry={() => setAttempt(attempt + 1)}
		/>
	);
}
function FeedbackInvitation({
	credential,
	onRetry,
}: Readonly<{ credential: FeedbackCredential | null; onRetry: () => void }>) {
	const resolveToken = useAction(api.feedback.responses.actions.resolveFeedbackToken);
	const resolveInvite = useAction(api.feedback.responses.actions.resolveOwnFeedbackInvite);
	const [result, setResult] = useState<
		| FunctionReturnType<typeof api.feedback.responses.actions.resolveFeedbackToken>
		| { status: "loading" | "error" | "submitted" }
	>({ status: "loading" });
	useEffect(() => {
		if (!credential) {
			setResult({ status: "invalid" });
			return;
		}
		let active = true;
		setResult({ status: "loading" });
		// Resolving only reads the invitation. A preview or retry must never submit a response.
		const request = "token" in credential ? resolveToken(credential) : resolveInvite(credential);
		void request.then(
			(value) => {
				if (active) setResult(value);
			},
			() => {
				if (active) setResult({ status: "error" });
			},
		);
		return () => {
			active = false;
		};
	}, [credential, resolveToken, resolveInvite]);
	if (result.status === "submitted") return <SubmissionReceipt />;
	if (result.status === "loading") return <output>{feedbackCopy.loading}</output>;
	if (result.status === "open" && credential)
		return <TokenFeedbackForm credential={credential} feedback={result} onComplete={setResult} />;
	if (result.status === "open") return null;
	const copy = feedbackStateCopy[result.status];
	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel
				{...copy}
				action={
					result.status === "error" ||
					result.status === "not-open" ||
					result.status === "unavailable" ? (
						<Button onClick={onRetry}>{feedbackCopy.retry}</Button>
					) : null
				}
			/>
		</div>
	);
}

function SubmissionReceipt() {
	const [secondsRemaining, setSecondsRemaining] = useState(5);
	useEffect(() => {
		const redirectAt = Date.now() + 5000;
		const countdown = window.setInterval(() => {
			setSecondsRemaining(Math.max(0, Math.ceil((redirectAt - Date.now()) / 1000)));
		}, 1000);
		const redirect = window.setTimeout(() => window.location.replace(MIDGARD_URL), 5000);
		return () => {
			window.clearInterval(countdown);
			window.clearTimeout(redirect);
		};
	}, []);
	return (
		<div className="mx-auto w-full max-w-3xl">
			<FormStatePanel
				{...feedbackStateCopy.submitted}
				action={
					<output aria-live="polite" className="text-muted-foreground text-sm">
						{feedbackCopy.redirectCountdown(secondsRemaining)}
					</output>
				}
			/>
		</div>
	);
}
