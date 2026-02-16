import { auth } from "@clerk/nextjs/server";
import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { humanReadableDate } from "@workspace/shared/utils";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EventResponseFrom } from "./form";

export default async function EventResponse({
	params,
}: Readonly<{
	params: Promise<{ slug: string }>;
}>) {
	const { slug: identifier } = await params;
	const event = await fetchQuery(api.events.getEvent, { identifier });

	const { userId, redirectToSignIn } = await auth();
	if (!userId) return redirectToSignIn();

	if (!event.formId) {
		return <h1>Det er ikke laget et spørreskjema til dette arrangementet</h1>;
	}

	const token = await getAuthToken();
	const ableToAnswer = await fetchQuery(
		api.forms.checkIfCurrentUserAttendedTheEventAndShouldBeAbleToSubmit,
		{ eventId: event._id },
		{ token },
	);

	if (!ableToAnswer) redirect("/");

	const response = await fetchQuery(
		api.forms.getCurrentUsersResponseByFormId,
		{ formId: event.formId },
		{ token },
	);

	if (response) {
		return (
			<div className="grid h-[calc(100vh-6rem)] place-content-center bg-background p-4">
				<div className="w-full max-w-lg space-y-6">
					<Card>
						<CardHeader className="text-center">
							<CardTitle className="font-bold text-2xl">
								Det ser ut til at du allerede har besvart spørreskjema
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6 text-center">
							<p className="text-muted-foreground">
								Tusen takk for at du tok deg tid til å svare. Du kan trykke på knappen under for å
								gå til din besvarelse
							</p>

							<Button asChild className="w-full">
								<Link href={`/event-feedback/${event.slug ?? identifier}/response`}>
									Gå til din besvarelse
								</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto mb-8 max-w-3xl">
			<div className="prose dark:prose-invert py-4 pb-8 prose-h1:text-primary dark:prose-h1:text-primary-foreground">
				<h1 className="hyphens-auto">
					Bedriftspresentasjonen "{event.title}",&shy;{" "}
					{humanReadableDate(new Date(event.eventStart))}
				</h1>
				<p className="max-w-[80ch]">
					Takk for at du kom på Bedriftspresentasjonen vår. Vi ønsker alltid å gjøre opplevelsen
					best mulig. Derfor så hadde vi satt pris på om du kunne svart på denne kjappe
					undersøkelsen.
				</p>
			</div>

			<EventResponseFrom event={event} userId={userId} />
		</div>
	);
}
