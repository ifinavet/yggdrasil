"use client";

import { Button } from "@workspace/ui/components/button";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useMemo } from "react";
import ResponsiveCenterContainer from "@/components/common/responsive-center-container";

function getErrorMessage(error: unknown): string {
	if (!error) return "Ukjent feil.";
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message || "Ukjent feil.";
	try {
		return JSON.stringify(error);
	} catch {
		return "Ukjent feil.";
	}
}

export default function GlobalError({ error, reset }: { error: unknown; reset: () => void }) {
	useEffect(() => {
		posthog.captureException(error, { site: "midgard" });
	}, [error]);

	const message = useMemo(() => getErrorMessage(error), [error]);

	return (
		<ResponsiveCenterContainer className='text-center'>
			<div className='mx-auto w-full max-w-xl'>
				<div className='mb-6 inline-flex items-center rounded-full border px-3 py-1 text-muted-foreground text-xs'>
					<span className='mr-2 inline-flex h-2 w-2 rounded-full bg-destructive' />
					Feil 500
				</div>

				<h1 className='mb-3 font-bold text-4xl tracking-tight sm:text-5xl'>
					Oisann! Noe gikk galt på serveren.
				</h1>

				<p className='mb-6 text-balance text-muted-foreground'>
					Det oppstod en intern feil. Prøv igjen om litt, eller gå tilbake til forsiden. Hvis
					problemet vedvarer, kontakt oss gjerne.
				</p>

				<div className='mx-auto mb-8 max-w-xl text-left'>
					<div className='mb-2 inline-flex items-center gap-2 font-medium text-foreground text-sm'>
						<AlertTriangle className='size-4 text-destructive' />
						Feildetaljer
					</div>
					<pre className='overflow-x-auto rounded-md border bg-muted/40 p-3 text-left font-mono text-muted-foreground text-xs leading-relaxed'>
						{message}
					</pre>
				</div>

				<div className='flex flex-col items-center justify-center gap-3 sm:flex-row'>
					<Button asChild>
						<Link href='/'>
							<Home className='mr-2 size-4' />
							Gå til forsiden
						</Link>
					</Button>

					<Button variant='outline' onClick={() => reset()}>
						<RefreshCcw className='mr-2 size-4' />
						Prøv igjen
					</Button>
				</div>

				<div className='mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3'>
					<div className='rounded-lg border p-4 text-left'>
						<h3 className='mb-1 font-semibold'>Hva skjedde?</h3>
						<p className='text-muted-foreground text-sm'>
							En intern serverfeil oppstod under lasting av siden.
						</p>
					</div>
					<div className='rounded-lg border p-4 text-left'>
						<h3 className='mb-1 font-semibold'>Prøv på nytt</h3>
						<p className='text-muted-foreground text-sm'>
							Last siden på nytt, eller kom tilbake senere.
						</p>
					</div>
					<div className='rounded-lg border p-4 text-left'>
						<h3 className='mb-1 font-semibold'>Kontakt oss</h3>
						<p className='text-muted-foreground text-sm'>
							Trenger du hjelp? Ta kontakt med support hvis problemet vedvarer.
						</p>
						<a className='text-muted-foreground text-sm italic' href='mailto:web@ifinavet.no'>
							Send oss en mail
						</a>
					</div>
				</div>
			</div>
		</ResponsiveCenterContainer>
	);
}
