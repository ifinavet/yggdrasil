import { auth } from "@clerk/nextjs/server";

export default async function Page() {
	const { userId, redirectToSignIn } = await auth();

	if (!userId) return redirectToSignIn();

	return (
		<div>
			<h1>Welcome to Bifrost!</h1>
			<p>This is the home page of Bifrost.</p>
		</div>
	);
}
