import { OrganizationList, SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { redirect } from "next/navigation";

export default async function AuthPage() {
	const { userId, redirectToSignIn, orgId } = await auth();

	if (!userId) return redirectToSignIn();

	if (orgId === process.env.NAVET_ORG_ID) redirect("/");

	return (
		<main className='grid place-items-center h-screen'>
			<Card className='w-1/2'>
				<CardHeader>
					<CardTitle>Uautorisert!</CardTitle>
					<CardDescription>Du er ikke autorisert til å bruke denne siden.</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4 items-center'>
					<p>
						Dersom du har kommet hit, men er et internt medlem i IFI-Navet, send en slack melding
						til webansvarlig.
					</p>
					{!orgId && <OrganizationList hidePersonal={true} />}
				</CardContent>
				<CardFooter>
					<Button variant='destructive' asChild>
						<SignOutButton>Logg ut</SignOutButton>
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
}
