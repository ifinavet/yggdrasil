"use client";

import { DevSignIn, isMockAuth } from "@workspace/auth/client";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import ClerkSignUp from "./clerk-sign-up";

export default function SignUpPage() {
	if (isMockAuth) {
		return (
			<ResponsiveCenterContainer>
				<div className="flex w-full justify-center py-10">
					<DevSignIn />
				</div>
			</ResponsiveCenterContainer>
		);
	}

	return <ClerkSignUp />;
}
