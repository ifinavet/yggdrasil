import { api } from "@workspace/backend/convex/api";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import ContainerCard from "@/components/cards/container-card";

export default function WaitlistPosition({
	className,
	registrations,
}: Readonly<{
	className?: string;
	registrations: FunctionReturnType<typeof api.registration.getByEventId>;
}>) {
	const { isAuthenticated } = useConvexAuth();
	const currentUser = useQuery(
		api.users.current,
		isAuthenticated ? undefined : "skip",
	);
	const waitlistPosition =
		registrations.waitlist.findIndex(
			(registration) => registration.userId === currentUser?._id,
		) + 1;

	return (
		isAuthenticated &&
		waitlistPosition !== 0 && (
			<ContainerCard className={className}>
				<p className="leading-7 [&:not(:first-child)]:mt-6">
					Du står på venteliste for dette arrangementet. Dersom det blir en
					ledig plass til deg så vil du mota en e-post, du har da 24 timer på å
					godta tilbudet om å bli med på arrangementet.
				</p>
				<p className="font-semibold text-lg">
					Du er nr. {waitlistPosition} på ventelisten.
				</p>
			</ContainerCard>
		)
	);
}
