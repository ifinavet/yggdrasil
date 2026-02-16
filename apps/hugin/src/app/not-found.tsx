import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { ExternalLink, FileQuestion, Mail } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="grid h-[calc(100vh-6rem)] place-content-center bg-background p-4">
			<div className="w-full max-w-lg space-y-6">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<FileQuestion className="h-8 w-8 text-muted-foreground" />
						</div>
						<CardTitle className="font-bold text-2xl">Siden ble ikke funnet</CardTitle>
						<CardDescription className="text-base">
							Denne siden eksisterer ikke eller har blitt flyttet.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6 text-center">
						<p className="text-muted-foreground">
							Du har mest sannsynlig havnet her ved en feil. Prøv å gå tilbake til ifinavet.no.
						</p>

						<Button asChild className="w-full">
							<Link href="https://ifinavet.no" target="_blank" rel="noopener noreferrer">
								<ExternalLink className="mr-2 h-4 w-4" />
								Gå til ifinavet.no
							</Link>
						</Button>

						<div className="border-t pt-4">
							<p className="text-muted-foreground text-sm">
								Tror du dette er en feil?{" "}
								<a
									href="mailto:web@ifinavet.no"
									className="inline-flex items-center gap-1 text-primary hover:underline dark:text-primary-light"
								>
									<Mail className="h-3 w-3" />
									Kontakt webansvarlig
								</a>
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
