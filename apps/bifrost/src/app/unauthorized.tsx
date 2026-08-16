import { getAuthUserId, isMockAuth, redirectToSignIn } from "@workspace/auth";
import { DevSignIn } from "@workspace/auth/client";
import Unauthorized from "@workspace/ui/components/unauthorized";

export default async function UnauthorizedPage() {
	const userId = await getAuthUserId();

	if (!userId) {
		if (isMockAuth) {
			return (
				<main className="grid h-screen w-full place-items-center p-6">
					<DevSignIn />
				</main>
			);
		}

		return redirectToSignIn();
	}

	return <Unauthorized />;
}
