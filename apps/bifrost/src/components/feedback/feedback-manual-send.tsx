"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@workspace/ui/components/command";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";
import { cn } from "@workspace/ui/lib/utils";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check } from "lucide-react";
import { useState } from "react";
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
				<CardTitle>Send skjema</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col items-start gap-3">
				<Command className="rounded-md border">
					<CommandInput placeholder="Søk etter deltaker" />
					<CommandList>
						<CommandGroup>
							{registrants?.map((registrant) => (
								<CommandItem
									key={registrant.userId}
									value={`${registrant.name} ${registrant.email}`}
									onSelect={() => setSelectedUserId(registrant.userId)}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											selectedUserId === registrant.userId ? "opacity-100" : "opacity-0",
										)}
									/>
									{registrant.name}
									<span className="text-muted-foreground">{registrant.email}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
				<Button disabled={!selectedUserId || sending} onClick={sendToSelected}>
					Send skjema
				</Button>
			</CardContent>
		</Card>
	);
}
