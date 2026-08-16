import { DevSignIn } from "@workspace/auth/client";
import { isMockAuth } from "@workspace/auth";
import { notFound } from "next/navigation";

export default function SignInPage() {
	if (!isMockAuth) return notFound();

	return (
		<main className="grid min-h-screen w-full place-items-center p-6">
			<DevSignIn />
		</main>
	);
}
