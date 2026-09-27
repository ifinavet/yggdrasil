"use client";

import { Authenticated } from "@workspace/auth/convex";
import { api } from "@workspace/backend/convex/api";
import { huginUrl } from "@workspace/shared/constants/hugin-url";
import { Button } from "@workspace/ui/components/button";
import { Note } from "@workspace/ui/components/note";
import { useQuery } from "convex/react";
import { useState } from "react";

export default function PendingFeedbackBanner() {
	return (
		<Authenticated>
			<PendingFeedback />
		</Authenticated>
	);
}

function PendingFeedback() {
	const [now] = useState(Date.now);
	const pending = useQuery(api.feedback.responses.queries.myPendingFeedback, { now });
	if (!pending) return null;
	const greeting = pending.firstName ? `${pending.firstName}, vi` : "Vi";
	const href = `${huginUrl()}/feedback?${new URLSearchParams({ invite: pending.inviteId, utm_source: "ifinavet", utm_medium: "banner", utm_campaign: "feedback_reminder" })}`;
	return (
		<div className="mx-4 max-w-6xl sm:mx-auto sm:w-full sm:px-6">
			<Note role="status">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p>
						{`${greeting} ser at du ikke har svart på tilbakemeldingsskjemaet for bedriftspresentasjonen med ${pending.companyName}. Skjemaet er obligatorisk.`}
					</p>
					<Button size="sm" asChild className="self-start sm:self-auto">
						<a href={href}>Gi tilbakemelding</a>
					</Button>
				</div>
			</Note>
		</div>
	);
}
