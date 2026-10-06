import { Button } from "@workspace/ui/components/button";
import { ChartPie, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { EventGuideHint, EventGuideReplay } from "./guide";

export function EventNav({ identifier }: Readonly<{ identifier: string }>) {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<Button asChild variant="link" className="text-foreground">
				<Link href={`/events/${identifier}`}>
					<Pencil className="size-4" /> Rediger og Administer
				</Link>
			</Button>
			<EventGuideHint step="registrations">
				<Button asChild variant="link" className="text-foreground">
					<Link href={`/events/${identifier}/registrations`}>
						<Users className="size-4" /> Påmeldte
					</Link>
				</Button>
			</EventGuideHint>
			<EventGuideHint step="report">
				<Button asChild variant="link" className="text-foreground">
					<Link href={`/events/${identifier}/report`}>
						<ChartPie className="size-4" /> Rapport
					</Link>
				</Button>
			</EventGuideHint>
			<EventGuideReplay />
		</div>
	);
}
