"use client";

import { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname } from "next/navigation";
import EditRegistration from "./edit-registration";
import RegisterForm from "./register-form";

export default function RegistrationButton({
	registration,
	availableSpots,
	disabled,
	event,
}: Readonly<{
	registration: FunctionReturnType<typeof api.registration.getByEventId>;
	availableSpots: number;
	disabled: boolean;
	event: Doc<"events">;
}>) {
	const path = usePathname();

	const { isAuthenticated } = useConvexAuth();
	const currentUser = useQuery(
		api.users.current,
		isAuthenticated ? undefined : "skip",
	);
	const currentUsersPoints = useQuery(
		api.points.getCurrentStudentsPoints,
		isAuthenticated ? undefined : "skip",
	);
	const numberOfPoints =
		currentUsersPoints?.reduce((acc, curr) => acc + curr.severity, 0) || 0;

	const currentUsersRegistration = registration.registered.find(
		(registration) => registration.userId === currentUser?._id,
	);
	const currentUsersWaitlistRegistration = registration.waitlist.find(
		(registration) => registration.userId === currentUser?._id,
	);

	if (!currentUser || !isAuthenticated) {
		return (
			<Button
				type="button"
				className="w-1/2 rounded-xl bg-zinc-800 py-8 text-lg text-primary-foreground hover:cursor-pointer hover:bg-zinc-700"
				asChild
			>
				<Link href={`/sign-in?redirect=${path}`}>Logg inn</Link>
			</Button>
		);
	}

	if (
		numberOfPoints >= 3 &&
		!currentUsersRegistration &&
		!currentUsersWaitlistRegistration
	) {
		return (
			<Button
				type="button"
				className="!opacity-100 w-3/4 whitespace-normal text-balance rounded-xl bg-amber-600 py-8 text-lg text-primary-foreground hover:cursor-pointer hover:bg-zinc-700"
				disabled
			>
				For mange prikker til å kunne melde deg på.
			</Button>
		);
	}

	if (!currentUsersRegistration && !currentUsersWaitlistRegistration) {
		return (
			<RegisterForm
				eventId={event._id}
				userId={currentUser._id}
				className={`w-3/4 whitespace-normal text-balance rounded-xl bg-emerald-600 px-6 py-8 text-center font-semibold text-lg text-primary-foreground hover:cursor-pointer hover:bg-emerald-700 md:w-1/2`}
				disabled={disabled}
				waitlist={availableSpots === 0}
			/>
		);
	}

	const registrationToEdit =
		currentUsersRegistration ?? currentUsersWaitlistRegistration;

	if (!registrationToEdit) return null;

	return (
		<EditRegistration
			registration={registrationToEdit}
			disabled={disabled}
			event={event}
		/>
	);
}
