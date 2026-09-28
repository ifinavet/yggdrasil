import { SignIn } from "@workspace/auth/client";
import { auth } from "@workspace/auth/server";
import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { redirectFromSearch, withRedirect } from "@/utils/auth-redirect";

export default async function SignInPage() {
	const { isAuthenticated } = await auth();
	const headerList = await headers();
	const redirectUrl = redirectFromSearch(headerList.get("x-searchParams") ?? "");

	if (isAuthenticated) return redirect("/");

	return (
		<ResponsiveCenterContainer>
			<div className="flex w-full justify-center py-10">
				<SignIn
					signUpUrl={withRedirect("/sign-up", redirectUrl)}
					fallbackRedirectUrl={redirectUrl}
					forceRedirectUrl={redirectUrl}
				/>
			</div>
		</ResponsiveCenterContainer>
	);
}
