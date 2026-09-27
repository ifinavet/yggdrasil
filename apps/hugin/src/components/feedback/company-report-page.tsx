"use client";

import { api } from "@workspace/backend/convex/api";
import type { FeedbackReport, ReportTextAnswer } from "@workspace/shared/feedback/report";
import { Button } from "@workspace/ui/components/button";
import { FeedbackReportView } from "@workspace/ui/components/feedback/report";
import { useAction } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { readFeedbackToken } from "@/lib/feedback/form";

const stateHeadings = {
	loading: "Henter rapport …",
	error: "Kunne ikke hente rapporten",
	invalid: "Rapporten er ikke tilgjengelig",
	ready: "Rapport fra bedriftspresentasjon",
};

function subscribe(onChange: () => void) {
	window.addEventListener("hashchange", onChange);
	return () => window.removeEventListener("hashchange", onChange);
}
export function CompanyReportPage() {
	const [attempt, setAttempt] = useState(0);
	const fragment = useSyncExternalStore(
		subscribe,
		() => window.location.hash,
		() => "",
	);
	return (
		<CompanyReport
			key={`${fragment}:${attempt}`}
			token={readFeedbackToken(fragment)}
			onRetry={() => setAttempt(attempt + 1)}
		/>
	);
}
function CompanyReport({
	token,
	onRetry,
}: Readonly<{ token: string | null; onRetry: () => void }>) {
	const resolve = useAction(api.feedback.reports.public.resolveReport);
	const [result, setResult] = useState<{
		report: FeedbackReport;
		answers: ReportTextAnswer[];
	} | null>(null);
	const [state, setState] = useState<"loading" | "ready" | "invalid" | "error">("loading");
	useEffect(() => {
		let active = true;
		let loading = false;
		let loaded = false;
		async function load() {
			if (loading) return;
			loading = true;
			if (!token) {
				setState("invalid");
				return;
			}
			try {
				const answers: ReportTextAnswer[] = [];
				let cursor: string | null = null;
				while (active) {
					const page = await resolve({ token, paginationOpts: { cursor, numItems: 100 } });
					if (!active) return;
					if (!page) {
						setResult(null);
						setState("invalid");
						return;
					}
					answers.push(...page.answers);
					if (page.isDone) {
						setResult({ report: page.report, answers });
						setState("ready");
						loaded = true;
						return;
					}
					cursor = page.continueCursor;
				}
			} catch {
				if (active && !loaded) {
					setResult(null);
					setState("error");
				}
			} finally {
				loading = false;
			}
		}
		void load();
		// Refresh access after returning to the tab, and while open, so revoked links stop displaying the report.
		const refresh = () => {
			if (document.visibilityState === "visible") void load();
		};
		const interval = window.setInterval(refresh, 60000);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			active = false;
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [token, resolve]);
	return (
		<div className="mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-[10px] border bg-card text-left lg:w-5xl">
			{state === "ready" && result ? (
				<FeedbackReportView report={result.report} answers={result.answers} />
			) : (
				<div className="space-y-4 p-8">
					<h1 className="font-semibold text-2xl">{stateHeadings[state]}</h1>
					{state === "invalid" ? (
						<p>Kontakt arrangøren dersom du trenger tilgang til rapporten.</p>
					) : null}
					{state === "error" ? (
						<Button
							onClick={() => {
								setState("loading");
								onRetry();
							}}
						>
							Prøv igjen
						</Button>
					) : null}
				</div>
			)}
		</div>
	);
}
