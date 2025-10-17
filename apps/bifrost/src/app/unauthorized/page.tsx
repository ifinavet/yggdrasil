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
import { getToken } from "@/lib/auth/auth-server";
import SignOut from "@/components/common/sign-out";

export default async function UnauthorizedPage() {
	const token = await getToken();

	if (!token) redirect("/sign-in");

	return (
		<main className="grid h-screen w-full place-items-center">
			<Card className="w-1/2">
				<CardHeader>
					<CardTitle>Uautorisert!</CardTitle>
					<CardDescription>
						Du er ikke autorisert til å bruke denne siden.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-4">
					<p>
						Dersom du har kommet hit, men er et internt medlem i IFI-Navet, send
						en slack melding til webansvarlig.
					</p>
				</CardContent>
				<CardFooter>
					<Button variant="destructive" asChild>
						<SignOut>Logg ut</SignOut>
					</Button>
				</CardFooter>
			</Card>
		</main>
	);
}
