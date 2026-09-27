import { auth } from "@workspace/auth/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteFeedbackPage, TokenFeedbackPage } from "@/components/feedback/token-feedback-page";

export const metadata: Metadata = {
	title: "Tilbakemelding",
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

type SearchParams = Promise<{ invite?: string | string[] }>;

export default function Page({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
	return (
		<Suspense>
			<FeedbackPage searchParams={searchParams} />
		</Suspense>
	);
}

async function FeedbackPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
	const { invite } = await searchParams;
	if (typeof invite !== "string") return <TokenFeedbackPage />;
	const { userId, redirectToSignIn } = await auth();
	if (!userId) return redirectToSignIn();
	return <InviteFeedbackPage inviteId={invite} />;
}
