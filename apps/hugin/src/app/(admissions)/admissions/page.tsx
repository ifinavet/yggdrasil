import { auth } from "@workspace/auth/server";
import AdmissionsApplication from "./_components/application";

export const instant = false;

export default async function Page() {
	const { userId, redirectToSignIn } = await auth();
	if (!userId) return redirectToSignIn();
	return <AdmissionsApplication />;
}
