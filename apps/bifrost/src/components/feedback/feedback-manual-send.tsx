"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { SearchSelect } from "@workspace/ui/components/search-select";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useId, useState } from "react";
import { toast } from "sonner";

export function FeedbackManualSend({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const enabled = useBrowserOptIn("huginFeedbackTestSend");
	return enabled ? <ManualSendCard eventId={eventId} /> : null;
}

function ManualSendCard({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const registrants = useQuery(api.feedback.manualSend.eligibility.listRegistrants, { eventId });
	const send = useAction(api.feedback.manualSend.send.send);
	const [selectedUserId, setSelectedUserId] = useState<Id<"users">>();
	const [sending, setSending] = useState(false);
	const titleId = useId();
	const sendToSelected = async () => {
		if (!selectedUserId) return;
		setSending(true);
		try {
			const name = await send({ eventId, userId: selectedUserId });
			toast.success(`Sendte skjema til ${name}`);
			setSelectedUserId(undefined);
		} catch (error) {
			toast.error(error instanceof ConvexError ? String(error.data) : "Kunne ikke sende skjema");
		} finally {
			setSending(false);
		}
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle id={titleId}>Send skjema</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col items-start gap-3">
				<SearchSelect
					aria-labelledby={titleId}
					className="w-full max-w-sm"
					items={registrants?.map(({ userId, name, email }) => ({
						id: userId,
						label: name,
						description: email,
					}))}
					value={selectedUserId ?? null}
					onChange={(userId) => setSelectedUserId(userId ? (userId as Id<"users">) : undefined)}
					placeholder="Velg en deltaker..."
					searchPlaceholder="Søk etter deltaker"
					emptyText="Fant ingen deltakere."
				/>
				<Button disabled={!selectedUserId || sending} onClick={sendToSelected}>
					Send skjema
				</Button>
			</CardContent>
		</Card>
	);
}
