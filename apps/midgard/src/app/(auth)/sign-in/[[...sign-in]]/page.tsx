import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";

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
