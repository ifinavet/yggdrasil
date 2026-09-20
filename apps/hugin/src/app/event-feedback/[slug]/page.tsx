import { getAuthToken } from "@workspace/auth";
import { auth } from "@workspace/auth/server";
import { api } from "@workspace/backend/convex/api";
import { humanReadableDate } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import { Check } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormStatePanel } from "@/components/form-state-panel";
import { questionCountWord } from "@/lib/event-feedback-questions";
import { EventResponseForm } from "./form";

export default async function EventResponse({
	params,
}: Readonly<{
	params: Promise<{ slug: string }>;
}>) {
	const { slug: identifier } = await params;

	const { userId, redirectToSignIn } = await auth();
	if (!userId) return redirectToSignIn();

	const token = await getAuthToken();
	const event = await fetchQuery(api.events.queries.getEvent, { identifier }, { token });

	if (!event.formId) {
		return <h1>Det er ikke laget et spørreskjema til dette arrangementet</h1>;
	}

	const ableToAnswer = await fetchQuery(
		api.forms.queries.checkIfCurrentUserAttendedTheEventAndShouldBeAbleToSubmit,
		{ eventId: event._id },
		{ token },
	);

	if (!ableToAnswer) redirect("/");

	const response = await fetchQuery(
		api.forms.queries.getCurrentUsersResponseByFormId,
		{ formId: event.formId },
		{ token },
	);

	if (response) {
		return (
			<div className="mx-auto w-full max-w-3xl">
				<FormStatePanel
					icon={<Check className="size-6" strokeWidth={2.4} />}
					title="Du har allerede svart på dette skjemaet"
					body="Tusen takk for at du tok deg tid. Du kan svare bare én gang per arrangement, men du kan se hva du svarte."
					action={
						<Button asChild className="h-[52px] w-full rounded-[13px] font-semibold text-[15.5px]">
							<Link href={`/event-feedback/${event.slug ?? identifier}/response`}>
								Se besvarelsen din
							</Link>
						</Button>
					}
					quiet={
						<>
							Svarte du feil?{" "}
							<a
								href="mailto:web@ifinavet.no"
								className="text-primary underline underline-offset-[3px]"
							>
								Gi beskjed til webansvarlig
							</a>
						</>
					}
				/>
			</div>
		);
	}

	return (
		<div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
			<div className="pt-1.5">
				<h1 className="m-0 mb-1.5 font-bold text-[21px] text-primary leading-[1.22] tracking-[-0.015em]">
					{event.title}
				</h1>
				<p className="m-0 mb-3 text-[13.5px] text-muted-foreground tabular-nums">
					{humanReadableDate(new Date(event.eventStart))}
				</p>
				<p className="m-0 mb-2 text-[14.5px] leading-normal">
					Takk for at du kom! {questionCountWord} kjappe spørsmål, det tar under et minutt. Svarene
					går bare til Navet og bedriften.
				</p>
				<p className="m-0 text-[13px] text-muted-foreground">
					Alle spørsmålene må besvares, bortsett fra det siste.
				</p>
			</div>

			<EventResponseForm event={event} userId={userId} />
		</div>
	);
}
