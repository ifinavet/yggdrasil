"use client";

import { huginUrl } from "@workspace/shared/constants";
import { formatSemesterDay } from "@workspace/shared/time";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { Copy, Link2, Mail } from "lucide-react";
import { toast } from "sonner";

/** The offer page on Hugin for a link token. The token is the only credential. */
export function offerUrl(token: string): string {
	return `${huginUrl()}/bestill-bedpres/tilbud/${token}`;
}

export type OfferEmail = { to: string; subject: string; body: string };

/**
 * The email Navet sends by hand with an offer: the date and the link where the company accepts,
 * asks for another date or declines. Nothing is sent automatically.
 */
export function offerEmail({
	to,
	contactName,
	date,
	url,
}: Readonly<{
	to: string;
	contactName: string;
	date: string;
	url: string;
}>): OfferEmail {
	const day = formatSemesterDay(date, "long");
	const firstName = contactName.split(/\s+/)[0] ?? contactName;

	return {
		to,
		subject: `Tilbud om bedriftsarrangement ${day}`,
		body: `Hei ${firstName},\n\nTakk for søknaden om bedriftsarrangement hos Navet. Vi kan tilby dere ${day}.\n\nSe tilbudet og svar her:\n${url}\n\nDer kan dere godta datoen, be om en annen dato eller takke nei.\n\nVennlig hilsen\nNavet`,
	};
}

async function copy(text: string, what: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`${what} er kopiert.`);
	} catch {
		toast.error("Kunne ikke kopiere. Marker teksten og kopier den selv.");
	}
}

/**
 * The offer link with «Kopier lenke», «Kopier e-posttekst» and «Åpne e-post», which opens the
 * editor's own email program with the text filled in.
 */
export function OfferLink({
	url,
	email,
	compact = false,
	className,
}: Readonly<{ url: string; email: OfferEmail; compact?: boolean; className?: string }>) {
	const mailto = `mailto:${encodeURIComponent(email.to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;

	return (
		<div className={cn("grid gap-2", className)}>
			{!compact && (
				<div className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-[13px]">
					<Link2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
					<span className="min-w-0 truncate font-mono text-muted-foreground" title={url}>
						{url}
					</span>
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<Button size="sm" variant="outline" onClick={() => copy(url, "Lenken")}>
					<Link2 /> Kopier lenke
				</Button>
				<Button size="sm" variant="outline" onClick={() => copy(email.body, "E-postteksten")}>
					<Copy /> Kopier e-posttekst
				</Button>
				<Button size="sm" asChild>
					<a href={mailto}>
						<Mail /> Åpne e-post
					</a>
				</Button>
			</div>
		</div>
	);
}
