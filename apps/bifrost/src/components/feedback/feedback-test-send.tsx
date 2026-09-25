"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { useBrowserOptIn } from "@workspace/ui/hooks/use-browser-opt-in";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { convexErrorMessage } from "@/utils/convex-error";

export function FeedbackTestSend({ eventId }: Readonly<{ eventId: Id<"events"> }>) {
	const enabled = useBrowserOptIn("huginFeedbackTestSend");
	const send = useAction(api.feedback.testSend.send.send);
	const [sending, setSending] = useState(false);
	if (!enabled) return null;
	const sendToMe = async () => {
		setSending(true);
		try {
			const count = await send({ eventId });
			toast.success(`Sendte ${count} testeposter til deg`);
		} catch (error) {
			toast.error(convexErrorMessage(error, "Kunne ikke sende testeposter"));
		} finally {
			setSending(false);
		}
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle>Testutsending</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col items-start gap-3">
				<p className="text-muted-foreground text-sm">
					Sender invitasjon, påminnelse og rapportlenke for dette arrangementet til din
					@ifinavet.no-adresse. Rapportlenken viser rapporten slik bedriften ser den etter
					godkjenning, i en uke. Tilbakemeldingslenkene åpner ingenting.
				</p>
				<Button disabled={sending} onClick={sendToMe}>
					{sending ? "Sender …" : "Send testeposter til meg"}
				</Button>
			</CardContent>
		</Card>
	);
}
