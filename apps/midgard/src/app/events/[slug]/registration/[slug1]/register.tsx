"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";

export default function Register({
	registrationId,
	eventId,
	response,
}: Readonly<{
	registrationId: Id<"registrations">;
	eventId: Id<"events">;
	response?: "accept" | "decline";
}>) {
	const [choice, setChoice] = useState(response);
	const [submitting, setSubmitting] = useState(false);
	const router = useRouter();
	const posthog = usePostHog();

	const acceptRegistration = useMutation(
		api.events.registrations.mutations.acceptPendingRegistration,
	);
	const handleAccept = () => {
		if (submitting) return;
		setSubmitting(true);
		return acceptRegistration({ id: registrationId })
			.then(() => {
				toast.success("Registreringen er akseptert!");
				router.push(`/events/${eventId}`);
			})
			.catch(() => {
				toast.error(
					"Oi! Det oppsto en feil! Prøv igjen senere eller kontakt ansvarlige for arrangementet",
				);
			})
			.finally(() => setSubmitting(false));
	};

	const unregister = useMutation(api.events.registrations.mutations.unregister);
	const handleUnregister = () => {
		if (submitting) return;
		setSubmitting(true);
		return unregister({ id: registrationId })
			.then(({ deletedRegistration, event, person }) => {
				posthog.capture("midgard-student_unregister", {
					unregistration_type: "Waitlist unregistration",
					deletedRegistration,
					event,
					person,
				});

				toast.success("Du har blitt avregistrert fra arrangementet!");
				router.push(`/events/${eventId}`);
			})
			.catch(() =>
				toast.error(
					"Oi! Det oppsto en feil! Prøv igjen senere eller kontakt ansvarlige for arrangementet",
				),
			)
			.finally(() => setSubmitting(false));
	};

	return (
		<div className="mx-auto flex w-3/4 flex-col gap-4">
			<h3 className="scroll-m-10 font-semibold text-2xl tracking-tight">
				Du har fått tilbud om plass til arrangementet
			</h3>

			<p className="not-first:mt-2 leading-7">
				Du har fått muligheten til å delta på arrangementet. Hvis du godtar, vil du bli registrert
				som deltaker. Hvis du ikke ønsker å delta, kan du avregistrere deg.
			</p>

			{choice && (
				<p className="font-semibold" role="status">
					{choice === "accept"
						? "Du har valgt ja. Bekreft at du vil ha plassen."
						: "Du har valgt nei. Bekreft at plassen skal gå videre til den neste på ventelisten."}
				</p>
			)}
			<div className="flex flex-wrap gap-4">
				{choice !== "decline" && (
					<Button
						className="h-auto whitespace-normal py-3"
						onClick={handleAccept}
						disabled={submitting}
					>
						{choice === "accept" ? "Bekreft ja, jeg vil ha plassen" : "Ja, jeg vil ha plassen"}
					</Button>
				)}
				{choice !== "accept" && (
					<Button
						className="h-auto whitespace-normal py-3"
						onClick={handleUnregister}
						variant="destructive"
						disabled={submitting}
					>
						{choice === "decline" ? "Bekreft nei, gi plassen videre" : "Nei, gi plassen videre"}
					</Button>
				)}
				{choice && (
					<Button onClick={() => setChoice(undefined)} variant="outline" disabled={submitting}>
						Endre svar
					</Button>
				)}
			</div>
		</div>
	);
}
