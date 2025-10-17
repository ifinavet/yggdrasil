"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

export default function SignOut({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const router = useRouter();

	return (
		<button
			type="button"
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
