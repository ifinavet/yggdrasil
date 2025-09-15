import { api } from "@workspace/backend/convex/api";
import { fetchQuery } from "convex/nextjs";
import { CalendarDays, Clock, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { EventWithParticipationCount } from "@/constants/event-types";
import {
	humanReadableDate,
	humanReadableDateTime,
	humanReadableTime,
} from "@/utils/dateFormatting";

function getRegistrationStatus(event: EventWithParticipationCount) {
	const now = new Date();

	const registrationOpensDate = new Date(event.registrationOpens);
	const eventStartDate = new Date(event.eventStart);

	const participants = event.participationCount;
	const participantsLimit = event.participationLimit;

	const registrationIsOpen = registrationOpensDate <= now;
	const eventActive = now.getTime() - eventStartDate.getTime() <= 2 * 60 * 60 * 1000;

	const registrationOpenToday =
		registrationIsOpen &&
		event.registrationOpens >= now.setHours(0, 0, 0, 0) &&
		event.registrationOpens < now.setHours(24, 0, 0, 0);

	const statusMessage = !registrationIsOpen
		? `Påmeldingen åpner ${humanReadableDateTime(registrationOpensDate)}`
		: participants >= participantsLimit
			? "Påmeldingen er full, sett deg på venteliste!"
			: registrationOpenToday
				? "Påmeldingen er åpen"
				: "Det er fortsatt ledige plasser";

	return {
		registrationOpen: registrationIsOpen,
		eventActive,
		statusMessage,
		cardColor: registrationIsOpen
			? "border-emerald-700 bg-emerald-700"
			: "border-zinc-400 bg-zinc-400",
	};
}

function RegistrationStatusBanner({
	show,
	statusMessage,
	cardColor,
}: {
	show: boolean;
	statusMessage: string;
	cardColor: string;
}) {
	if (!show) return null;

	return (
		<div className='flex justify-end'>
			<p
				className={`w-fit ${cardColor} -mb-2 rounded-t-md px-4 pt-4 pb-4 text-primary-foreground md:pb-0 dark:text-primary-foreground`}
			>
				{statusMessage}
			</p>
		</div>
	);
}

// Event details component
function EventDetails({ event }: { event: EventWithParticipationCount }) {
	const participantsLimit = event.participationLimit;

	return (
		<div className='flex w-full flex-col justify-between gap-6 px-4 py-4 text-zinc-100 sm:pr-4 md:col-span-5 md:px-0 lg:pr-32'>
			<EventHeader title={event.title} teaser={event.teaser} />
			<EventMetadata eventStart={event.eventStart} participantsLimit={participantsLimit} />
		</div>
	);
}

// Event header component
function EventHeader({ title, teaser }: { title: string | null; teaser: string | null }) {
	return (
		<div className='grid w-full gap-2'>
			<h2 className='font-bold text-2xl tracking-tight'>{title}</h2>
			<p className='line-clamp-2 scroll-m-20 text-ellipsis font-medium text-lg tracking-tight'>
				{teaser}
			</p>
		</div>
	);
}

// Event metadata component
function EventMetadata({
	eventStart,
	participantsLimit,
}: {
	eventStart: number;
	participantsLimit: number;
}) {
	return (
		<div className='flex w-full flex-col justify-between gap-2 pb-2 font-semibold text-lg sm:flex-row'>
			<div className='flex items-center gap-2'>
				<CalendarDays className='size-6' />
				{humanReadableDate(new Date(eventStart))}
			</div>
			<div className='flex items-center gap-2'>
				<Clock className='size-6' />
				{humanReadableTime(new Date(eventStart))}
			</div>
			<div className='flex items-center gap-2'>
				<Users className='size-6' />
				{participantsLimit}
			</div>
		</div>
	);
}

// Company image component
function CompanyImage({ imageUrl, title }: { imageUrl: string; title: string }) {
	return (
		<div className="relative col-span-2 grid h-full min-h-32 place-content-center rounded-r-md bg-white px-6 py-4 dark:bg-zinc-100/95">
			<Image src={imageUrl} alt={title} className='object-contain px-4 py-6 md:px-6' fill />
		</div>
	);
}

// Main EventCard component
export default async function EventCard({
	event,
	isExternal,
}: {
	event: EventWithParticipationCount;
	isExternal: boolean;
}) {
	const image = await fetchQuery(api.companies.getById, {
		id: event.hostingCompany,
	});

	const { eventActive, statusMessage, cardColor } = getRegistrationStatus(event);

	return (
		<Link href={`/events/${event._id}`}>
			{!isExternal && (
				<RegistrationStatusBanner
					show={eventActive}
					statusMessage={statusMessage}
					cardColor={cardColor}
				/>
			)}
			<div
				className={`overflow-hidden rounded-lg border-3 md:h-56 ${cardColor} grid gap-4 md:grid-cols-7`}
			>
				<CompanyImage imageUrl={image.imageUrl} title={event.title} />
				<EventDetails event={event} />
			</div>
		</Link>
	);
}
