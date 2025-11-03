"use client";

import { api } from "@workspace/backend/convex/api";
import type { Id } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function Register({
	preloadedRegistration,
	eventId,
}: Readonly<{
	preloadedRegistration: Preloaded<typeof api.registration.getById>;
	eventId: Id<"events">;
}>) {
	const registration = usePreloadedQuery(preloadedRegistration);

	const router = useRouter();

	const acceptRegistration = useMutation(
		api.registration.acceptPendingRegistration,
	);
	const handleAccept = async () =>
		acceptRegistration({ id: registration._id })
			.then(() => {
				toast.success("Registreringen er akseptert!");
				router.push(`/events/${eventId}`);
			})
			.catch(() => {
				toast.error(
					"Oi! Det oppsto en feil! Prøv igjen senere eller kontakt ansvarlige for arrangementet",
				);
			});

	const unregister = useMutation(api.registration.unregister);
	const handleUnregister = async () =>
		unregister({ id: registration._id })
			.then(() => {
				toast.success("Du har blitt avregistrert fra arrangementet!");
				router.push(`/events/${eventId}`);
			})
			.catch(() => {
				toast.error(
					"Oi! Det oppsto en feil! Prøv igjen senere eller kontakt ansvarlige for arrangementet",
				);
			});

	return (
		<div className="mx-auto flex w-3/4 flex-col gap-4">
			<h3 className="scroll-m-10 font-semibold text-2xl tracking-tight">
				Du har fått tilbud om plass til arrangementet
			</h3>

			<p className="leading-7 [&:not(:first-child)]:mt-2">
				Du har fått muligheten til å delta på arrangementet. Hvis du godtar, vil
				du bli registrert som deltaker. Hvis du ikke ønsker å delta, kan du
				avregistrere deg.
			</p>

			<div className="flex gap-4">
				<Button onClick={handleAccept}>Godta tilbudet</Button>
				<Button onClick={handleUnregister} variant={"destructive"}>
					Avregistrer deg
				</Button>
			</div>
		</div>
	);
}
