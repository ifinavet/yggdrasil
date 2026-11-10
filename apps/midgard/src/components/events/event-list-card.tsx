import { humanReadableDate, humanReadableTime } from "@workspace/shared/time";
import { CalendarDays, Clock, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { EventWithParticipationCount } from "@/constants/event-types";
import { registrationStatus } from "@/utils/event-availability";

function RegistrationStatusBanner({
	show,
	statusMessage,
	cardColor,
}: Readonly<{
	show: boolean;
	statusMessage: string;
	cardColor: string;
}>) {
	if (!show) return null;

	return (
		<div className="flex justify-end">
			<p
				className={`w-fit ${cardColor} -mb-2 rounded-t-md px-4 pt-4 pb-4 text-primary-foreground md:pb-0 dark:text-primary-foreground`}
			>
				{statusMessage}
			</p>
		</div>
	);
}

// Event details component
function EventDetails({ event }: Readonly<{ event: EventWithParticipationCount }>) {
	const participantsLimit = event.participationLimit;

	return (
		<div className="flex w-full flex-col justify-between gap-6 px-4 py-4 text-zinc-100 sm:pr-4 md:col-span-5 md:px-0 lg:pr-32">
			<EventHeader title={event.title} teaser={event.teaser} />
			<EventMetadata eventStart={event.eventStart} participantsLimit={participantsLimit} />
		</div>
	);
}

// Event header component
function EventHeader({
	title,
	teaser,
}: Readonly<{
	title: string | null;
	teaser: string | null;
}>) {
	return (
		<div className="grid w-full gap-2">
			<h2 className="font-bold text-2xl tracking-tight">{title}</h2>
			<p className="line-clamp-2 scroll-m-20 font-medium text-lg tracking-tight">{teaser}</p>
		</div>
	);
}

// Event metadata component
function EventMetadata({
	eventStart,
	participantsLimit,
}: Readonly<{
	eventStart: number;
	participantsLimit: number;
}>) {
	return (
		<div className="flex w-full flex-col justify-between gap-2 pb-2 font-semibold text-lg sm:flex-row">
			<div className="flex items-center gap-2">
				<CalendarDays className="size-6" />
				{humanReadableDate(new Date(eventStart))}
			</div>
			<div className="flex items-center gap-2">
				<Clock className="size-6" />
				{humanReadableTime(new Date(eventStart))}
			</div>
			<div className="flex items-center gap-2">
				<Users className="size-6" />
				{participantsLimit}
			</div>
		</div>
	);
}

// Company image component
function CompanyImage({
	imageUrl,
	title,
}: Readonly<{
	imageUrl: string | null;
	title: string;
}>) {
	return (
		<div className="relative col-span-2 grid h-full min-h-32 place-content-center rounded-r-md bg-white px-6 py-4 dark:bg-zinc-100/95">
			{imageUrl && (
				<Image
					src={imageUrl}
					alt={title}
					className="object-contain px-4 py-6 md:px-6"
					sizes="(min-width: 768px) 20rem, 100vw"
					fill
				/>
			)}
		</div>
	);
}

// Main EventCard component
export default function EventCard({
	event,
}: Readonly<{
	event: EventWithParticipationCount;
}>) {
	const { showBanner, statusMessage, cardColor } = registrationStatus(event, new Date());

	return (
		<Link href={`/events/${event.slug ?? event._id}`}>
			{!event.externalUrl && (
				<RegistrationStatusBanner
					show={showBanner}
					statusMessage={statusMessage}
					cardColor={cardColor}
				/>
			)}
			<div
				className={`overflow-hidden rounded-lg border-3 md:h-56 ${cardColor} grid gap-4 md:grid-cols-7`}
			>
				<CompanyImage imageUrl={event.hostingCompanyLogoUrl} title={event.title} />
				<EventDetails event={event} />
			</div>
		</Link>
	);
}
