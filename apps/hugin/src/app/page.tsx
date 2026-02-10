import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { ExternalLink, MapPinOff } from "lucide-react";
import Link from "next/link";

export default function Page() {
	return (
		<div className="grid h-[calc(100vh-6rem)] place-content-center bg-background p-4">
			<div className="w-full max-w-lg space-y-6">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<MapPinOff className="h-8 w-8 text-muted-foreground" />
						</div>
						<CardTitle className="font-bold text-2xl">
							Det ser ut som du har gått deg vill
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6 text-center">
						<p className="text-muted-foreground">
							Du er nok ute etter hovedsiden vår. Trykk på knappen under for å gå tilbake til
							ifinavet.no.
						</p>

						<Button asChild className="w-full">
							<Link href="https://ifinavet.no" target="_blank" rel="noopener noreferrer">
								<ExternalLink className="mr-2 h-4 w-4" />
								Gå til ifinavet.no
							</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
