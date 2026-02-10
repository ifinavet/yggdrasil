"use client";

import { Button } from "@workspace/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { AlertTriangle, ExternalLink, Home, Mail, RefreshCw } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect } from "react";

interface ErrorProps {
	readonly error: Error & { digest?: string };
	readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: Readonly<ErrorProps>) {
	useEffect(() => {
		posthog.captureException(error, { site: "hugin" });
	}, [error]);

	return (
		<div className="grid h-[calc(100vh-6rem)] place-content-center bg-background p-4">
			<div className="w-full max-w-lg space-y-6">
				<Card>
					<CardHeader className="text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-8 w-8 text-destructive" />
						</div>
						<CardTitle className="font-bold text-2xl">Noe gikk galt</CardTitle>
						<CardDescription className="text-base">
							En uventet feil oppstod. Vi beklager ulempene.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6 text-center">
						<p className="text-muted-foreground">
							Du kan prøve å laste siden på nytt. Hvis problemet vedvarer, ta gjerne kontakt med
							webansvarlig.
						</p>

						{error.digest && (
							<p className="text-muted-foreground text-xs">
								Feil-ID: <code className="rounded bg-muted px-1.5 py-0.5">{error.digest}</code>
							</p>
						)}

						<div className="flex flex-col justify-center gap-3 sm:flex-row">
							<Button variant="default" onClick={reset} className="flex items-center gap-2">
								<RefreshCw className="h-4 w-4" />
								Prøv igjen
							</Button>
							<Button variant="outline" asChild className="flex items-center gap-2">
								<Link href="https://ifinavet.no" target="_blank" rel="noopener noreferrer">
									<ExternalLink className="h-4 w-4" />
									Gå til ifinavet.no
								</Link>
							</Button>
						</div>

						<div className="border-t pt-4">
							<p className="text-muted-foreground text-sm">
								Trenger du hjelp?{" "}
								<a
									href="mailto:web@ifinavet.no"
									className="inline-flex items-center gap-1 text-primary hover:underline dark:text-primary-light"
								>
									<Mail className="h-3 w-3" />
									Kontakt webansvarlig
								</a>
								{error.digest && (
									<>
										{" "}
										og oppgi feil-ID:{" "}
										<code className="rounded bg-muted px-1 py-0.5 text-xs">{error.digest}</code>
									</>
								)}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
