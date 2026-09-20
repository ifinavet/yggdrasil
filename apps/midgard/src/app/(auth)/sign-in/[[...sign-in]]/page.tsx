import { SignIn } from "@workspace/auth/client";
import { auth } from "@workspace/auth/server";
import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function SignInPage() {
	const { isAuthenticated } = await auth();
	const headerList = await headers();
	const searchParam = headerList.get("x-searchParams") || "/";

	const redirectUrl = searchParam.includes("=")
		? decodeURIComponent(searchParam.split("=")[1] || "/")
		: "/";

	if (isAuthenticated) return redirect("/");

	return (
		<ResponsiveCenterContainer>
			<div className="flex w-full justify-center py-10">
				<SignIn
					signUpUrl="/sign-up"
					fallbackRedirectUrl={redirectUrl}
					forceRedirectUrl={redirectUrl}
				/>
			</div>
		</ResponsiveCenterContainer>
	);
}
