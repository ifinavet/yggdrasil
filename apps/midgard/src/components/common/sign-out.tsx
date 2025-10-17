"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export default function SignOut({
	className,
	children,
}: Readonly<{ className?: string; children: React.ReactNode }>) {
	const router = useRouter();

	return (
		<button
			type="button"
			className={className}
			onClick={() => {
				authClient.signOut({
					fetchOptions: {
						onSuccess: () => {
							router.push("/sign-in");
						},
					},
				});
			}}
		>
			{children}
		</button>
	);
}
