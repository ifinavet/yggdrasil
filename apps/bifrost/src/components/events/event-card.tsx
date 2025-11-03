"use client";

import type { Id } from "@workspace/backend/convex/dataModel";
import { Badge } from "@workspace/ui/components/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Organizer } from "@/constants/types";
import { useSelectedEventsStore } from "@/lib/stores/selected-events";
import { humanReadableDate } from "@/utils/utils";

export default function EventCard({
	title,
	eventId,
	companyName,
	date,
	isPublished,
	externalUrl,
	organizers,
}: Readonly<{
	title: string;
	eventId: Id<"events">;
	companyName: string;
	date: number;
	isPublished: boolean;
	externalUrl?: string;
	organizers: Organizer[];
}>) {
	const [selected, setSelected] = useState(false);
	const addEvent = useSelectedEventsStore((state) => state.addEvent);
	const removeEvent = useSelectedEventsStore((state) => state.removeEvent);

	const isExternal = !(externalUrl === undefined || externalUrl === "");

	function handleCheckboxChange(checked: boolean) {
		setSelected(checked);
		if (checked) {
			addEvent(eventId);
		} else {
			removeEvent(eventId);
		}
	}

	return (
		<div className="relative flex flex-col gap-6">
			<Card className={`h-full ${selected ? "outline-2 outline-primary" : ""}`}>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					<CardDescription>{humanReadableDate(new Date(date))}</CardDescription>
					<CardAction>
						<div className="relative z-20">
							<Checkbox
								checked={selected}
								onCheckedChange={(checked) => handleCheckboxChange(!!checked)}
							/>
						</div>
					</CardAction>
				</CardHeader>
				<CardContent className="flex flex-1 flex-col gap-4">
					<div className="flex flex-row flex-wrap gap-2">
						<h3>
							<span className="font-semibold">Bedrift:</span> {companyName}
						</h3>
					</div>
					<div className="flex flex-wrap gap-2">
						{isExternal && <Badge>Externt arrangement</Badge>}
						{!isPublished && <Badge variant="secondary">Avpublisert</Badge>}
					</div>
				</CardContent>
				<CardFooter className="flex-col items-start gap-1.5 text-sm">
					<div className="line-clamp-1 flex gap-2 font-medium">
						<Users className="size-4" /> Ansvarlige
					</div>
					<div className="text-muted-foreground">
						{organizers.map((organizer) => (
							<h3 key={organizer._id}>
								<span className="font-semibold capitalize">
									{organizer.role}:{" "}
								</span>
								{organizer.name}
							</h3>
						))}
					</div>
				</CardFooter>
			</Card>
			<Link
				href={`/events/${eventId}`}
				aria-label={`Open event ${title}`}
				className="absolute inset-0 z-10"
			>
				<span className="sr-only">Open event</span>
			</Link>
		</div>
	);
}
