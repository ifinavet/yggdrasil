"use client";

import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FormStatePanel } from "@/components/form-state-panel";
import { feedbackCopy, feedbackStateCopy } from "@/lib/feedback/copy";
import { readFeedbackToken } from "@/lib/feedback/form";
import { TokenFeedbackForm } from "./token-feedback-form";

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
	return (
		<FeedbackInvitation
			key={`${fragment}:${attempt}`}
			token={readFeedbackToken(fragment)}
			onRetry={() => setAttempt(attempt + 1)}
		/>
	);
}
function FeedbackInvitation({
	token,
	onRetry,
}: Readonly<{ token: string | null; onRetry: () => void }>) {
	const resolveToken = useAction(api.feedback.responses.actions.resolveFeedbackToken);
	const [result, setResult] = useState<
		| FunctionReturnType<typeof api.feedback.responses.actions.resolveFeedbackToken>
		| { status: "loading" | "error" | "submitted" }
	>({ status: "loading" });
	useEffect(() => {
		if (!token) {
			setResult({ status: "invalid" });
			return;
		}
		let active = true;
		setResult({ status: "loading" });
		// Resolving only reads the invitation. A preview or retry must never submit a response.
		void resolveToken({ token }).then(
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
	}, [token, resolveToken]);
	if (result.status === "loading") return <output>{feedbackCopy.loading}</output>;
	if (result.status === "open" && token)
		return <TokenFeedbackForm token={token} feedback={result} onComplete={setResult} />;
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
