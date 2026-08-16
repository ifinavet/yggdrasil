import { SignIn } from "@clerk/nextjs";
import { getAuthUserId, isMockAuth } from "@workspace/auth";
import { DevSignIn } from "@workspace/auth/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";

export default async function SignInPage() {
	const userId = await getAuthUserId();
	const headerList = await headers();
	const searchParam = headerList.get("x-searchParams") || "/";

	const requestedUrl = searchParam.includes("=")
		? decodeURIComponent(searchParam.split("=")[1] || "/")
		: "/";

	const redirectUrl =
		requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/";

	if (userId) return redirect("/");

	return (
		<ResponsiveCenterContainer>
			<div className="flex w-full justify-center py-10">
				{isMockAuth ? (
					<DevSignIn />
				) : (
					<SignIn
						signUpUrl="/sign-up"
						fallbackRedirectUrl={redirectUrl}
						forceRedirectUrl={redirectUrl}
					/>
				)}
			</div>
		</ResponsiveCenterContainer>
	);
}
