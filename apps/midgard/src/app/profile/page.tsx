import { getAuthToken } from "@workspace/auth";
import { auth } from "@workspace/auth/server";
import { api } from "@workspace/backend/convex/api";
import ResponsiveCenterContainer from "@workspace/ui/components/responsive-center-container";
import { Title } from "@workspace/ui/components/title";
import { preloadQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import type { Metadata } from "next";
import { Suspense } from "react";
import Points from "@/components/profile/points";
import Registrations from "@/components/profile/registrations";
import UpdateProfileForm from "@/components/profile/update-profile-form";

export const metadata: Metadata = {
	title: "Profil",
};

export default async function ProfilePage() {
	const { userId, redirectToSignIn } = await auth();
	const token = await getAuthToken();

	if (!userId) return redirectToSignIn();

	const preloadStudent = await preloadQuery(
		api.users.students.queries.getCurrent,
		{},
		{ token },
	).catch((error) => {
		if (error instanceof ConvexError) return null;
		throw error;
	});

	if (!preloadStudent) {
		return (
			<ResponsiveCenterContainer>
				<Title>Din Profil</Title>
				<p>Studentprofilen din er ikke klar ennå. Prøv å laste siden på nytt om litt.</p>
			</ResponsiveCenterContainer>
		);
	}

	return (
		<ResponsiveCenterContainer>
			<Title>Din Profil</Title>
			<div className="grid max-w-full gap-6 align-top lg:grid-cols-2">
				<div>
					<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0 dark:text-primary-foreground">
						Din profil
					</h2>
					<Suspense>
						<UpdateProfileForm preloadedStudent={preloadStudent} className="mt-4" />
					</Suspense>
				</div>
				<div className="row-span-2">
					<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0 dark:text-primary-foreground">
						Dine prikker
					</h2>
					<Points className="mt-4" />
				</div>
				<div className="h-full">
					<h2 className="scroll-m-20 border-b pb-2 font-semibold text-3xl text-primary tracking-tight first:mt-0 dark:text-primary-foreground">
						Dine kommende bedriftspresentasjoner
					</h2>
					<Registrations className="mt-4" />
				</div>
			</div>
		</ResponsiveCenterContainer>
	);
}
