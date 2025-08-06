"use client"

import ResponsiveCenterContainer from "@/components/common/responsive-center-container";
import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function SignInPage() {
  const params = useSearchParams()
  const redirectUrl = params.get("redirect") || "/";

  return (
    <ResponsiveCenterContainer>
      <div className="w-full flex justify-center py-10">
        <SignIn signUpUrl="/sign-up" fallbackRedirectUrl={redirectUrl} forceRedirectUrl={redirectUrl} />
      </div>
    </ResponsiveCenterContainer>
  )
}
