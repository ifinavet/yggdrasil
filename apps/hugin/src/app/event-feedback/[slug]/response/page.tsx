import { getAuthToken } from "@workspace/auth";
import { auth } from "@workspace/auth/server";
import { api } from "@workspace/backend/convex/api";
import { humanReadableDate } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { FormStatePanel } from "@/components/form-state-panel";
import { ReadonlyEventResponseForm, type ResponseData } from "./readonly-form";

export default async function EventFeedbackResponsePage({
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

	const response = await fetchQuery(
		api.forms.queries.getCurrentUsersResponseByFormId,
		{
			formId: event.formId,
		},
		{ token },
	);

	if (!response) {
		return (
			<div className="mx-auto w-full max-w-3xl">
				<FormStatePanel
					title="Du har ikke svart på dette skjemaet ennå"
					body="Vi hadde satt stor pris på om du ville svare. Trykk på knappen under for å gå til skjemaet."
					action={
						<Button asChild className="h-[52px] w-full rounded-[13px] font-semibold text-[15.5px]">
							<Link href={`/event-feedback/${event.slug ?? event._id}`}>Gå til spørreskjemaet</Link>
						</Button>
					}
				/>
			</div>
		);
	}

	return (
		<div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
			<div className="pt-1.5">
				<h1 className="m-0 mb-1.5 font-bold text-[21px] text-primary leading-[1.22] tracking-[-0.015em]">
					Svaret ditt
				</h1>
				<p className="m-0 text-[13.5px] text-muted-foreground tabular-nums">
					<span className="block">{event.title}</span>
					<span className="block">{humanReadableDate(new Date(event.eventStart))}</span>
				</p>
			</div>

			<ReadonlyEventResponseForm data={response.data as ResponseData} />
		</div>
	);
}
