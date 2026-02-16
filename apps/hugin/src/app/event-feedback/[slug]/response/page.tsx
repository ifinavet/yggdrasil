import { auth } from "@clerk/nextjs/server";
import { getAuthToken } from "@workspace/auth";
import { api } from "@workspace/backend/convex/api";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { fetchQuery } from "convex/nextjs";
import Link from "next/link";
import { ReadonlyEventResponseForm, type ResponseData } from "./readonly-form";

export default async function EventFeedbackResponsePage({
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
	const response = await fetchQuery(
		api.forms.getCurrentUsersResponseByFormId,
		{
			formId: event.formId,
		},
		{ token },
	);

	if (!response) {
		return (
			<div className="grid h-[calc(100vh-6rem)] place-content-center bg-background p-4">
				<div className="w-full max-w-lg space-y-6">
					<Card>
						<CardHeader className="text-center">
							<CardTitle className="font-bold text-2xl">
								Det ser ut til at du ikke har besvart spørreskjema
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6 text-center">
							<p className="text-muted-foreground">
								Vi hadde satt veldig pris på om du ville svare på spørreskjema. Tykk på knappen
								under for å bli tatt til skjema.
							</p>

							<Button asChild className="w-full">
								<Link href={`/event-feedback/${event.slug ?? event._id}`}>Gå til spørreskjema</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto mb-8 max-w-3xl">
			<div className="prose dark:prose-invert max-w-[80ch] py-4 pb-8 prose-h1:text-primary dark:prose-h1:text-primary-foreground">
				<h1>Her er ditt svar på spørre skjema for arrangementet "{event.title}"</h1>
				<p>Takk for at du kom på Bedriftspresentasjonen vår og at du fylte ut spørreskjema vårt.</p>
			</div>

			{response && <ReadonlyEventResponseForm data={response.data as ResponseData} />}
		</div>
	);
}
