import { CalendarDays, Users } from "lucide-react";
import Image from "next/image";
import { humanReadableDate } from "@/utils/dateFormatting";

export type EventCardType = {
	companyImage: string;
	companyTitle: string;
	title: string;
	teaser: string;
	participationLimit?: number;
	eventDate?: Date;
};

export default function EventCard({
	event,
}: Readonly<{ event: EventCardType }>) {

	const isExpired =
		event.eventDate ? event.eventDate < new Date() : false;

	return (
		<div className="flex h-100 flex-col overflow-clip rounded-lg border border-primary/10 shadow-md">
			<div className="relative grid h-32 place-content-center px-8 py-6 md:h-48 lg:h-52 dark:bg-white/95">
				<Image
					src={event.companyImage}
					alt={event.companyTitle}
					className="object-contain p-6"
					sizes="50vw"
					fill
				/>
			</div>

			<div
				className={`flex flex-1 flex-col justify-between gap-4 p-6 ${
		isExpired
			? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white"
			: "bg-primary text-primary-foreground dark:bg-gray-800"
	}`}
			>
				<div className="flex flex-col gap-4">
					<h2 className="font-bold text-xl tracking-tight">
						{event.title}
					</h2>
					<p className="line-clamp-2 whitespace-normal">
						{event.teaser}
					</p>
				</div>

				{!!(event.eventDate && event.participationLimit) && (
					<div className="flex flex-col justify-center gap-4 sm:flex-row">
						<p className="flex gap-2">
							<Users /> {event.participationLimit}
						</p>
						<p className="flex gap-2">
							<CalendarDays />{" "}
							{humanReadableDate(event.eventDate)}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
