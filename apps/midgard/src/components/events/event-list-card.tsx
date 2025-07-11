import { CalendarDays, Clock, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getCompanyImageById } from "@/lib/query/companies";
import type { Tables } from "@/lib/supabase/database.types";
import {
	humanReadableDate,
	humanReadableDateTime,
	humanReadableTime,
} from "@/uitls/dateFormatting";

function getRegistrationStatus(event: Tables<"published_events_with_participation_count">) {
	const now = new Date();

	if (!event.registration_opens || !event.event_start) {
		return {
			registrationOpen: false,
			eventActive: false,
			statusMessage: "Ugyldig arrangementdata",
			cardColor: "border-zinc-400 bg-zinc-400",
		};
	}

	const registrationOpensDate = new Date(event.registration_opens);
	const eventStartDate = new Date(event.event_start);
	const participants = event.participants ?? 0;
	const participantsLimit = event.participants_limit ?? 0;

	const registrationOpen = registrationOpensDate <= now;
	const eventActive = registrationOpensDate < now && eventStartDate > now;

	const registrationOpenToday =
		registrationOpensDate.getFullYear() === now.getFullYear() &&
		registrationOpensDate.getMonth() === now.getMonth() &&
		registrationOpensDate.getDate() === now.getDate() &&
		registrationOpensDate.getHours() === now.getHours();

	let statusMessage = "";
	if (participants === participantsLimit) {
		statusMessage = "Påmeldingen er full";
	} else if (participants < participantsLimit) {
		statusMessage = "Det er fortsatt ledige plasser";
	} else if (registrationOpenToday) {
		statusMessage = "Påmeldingen er åpen";
	} else {
		statusMessage = `Påmeldingen åpner ${humanReadableDateTime(registrationOpensDate)}`;
	}

	return {
		registrationOpen,
		eventActive,
		statusMessage,
		cardColor: registrationOpen
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
				className={`w-fit ${cardColor} -mb-2 rounded-t-md px-4 pt-4 pb-4 text-primary-foreground md:pb-0`}
			>
				{statusMessage}
			</p>
		</div>
	);
}

// Event details component
function EventDetails({ event }: { event: Tables<"published_events_with_participation_count"> }) {
	const participantsLimit = event.participants_limit ?? 0;

	return (
		<div className='flex w-full flex-col justify-between gap-6 px-4 py-4 text-zinc-100 sm:pr-4 md:col-span-5 md:px-0 lg:pr-32'>
			<EventHeader title={event.title} teaser={event.teaser} />
			{event.event_start && (
				<EventMetadata eventStart={event.event_start} participantsLimit={participantsLimit} />
			)}
		</div>
	);
}

// Event header component
function EventHeader({ title, teaser }: { title: string | null; teaser: string | null }) {
	return (
		<div className='grid w-full gap-2'>
			<h2 className='font-bold text-2xl tracking-tight'>{title}</h2>
			<p className='scroll-m-20 font-medium text-lg tracking-tight'>{teaser}</p>
		</div>
	);
}

// Event metadata component
function EventMetadata({
	eventStart,
	participantsLimit,
}: {
	eventStart: string;
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
function CompanyImage({ imageUrl, title }: { imageUrl?: string; title: string | null }) {
	return (
		<div className='col-span-2 grid h-full place-content-center rounded-r-md bg-zinc-50 px-6 py-4'>
			<Image src={imageUrl || ""} alt={title ?? ""} width={200} height={200} className='max-h-36' />
		</div>
	);
}

// Main EventCard component
export default async function EventCard({
	event,
	isExternal,
}: {
	event: Tables<"published_events_with_participation_count">;
	isExternal: boolean;
}) {
	if (!event.company_id || !event.registration_opens || !event.event_start) {
		return null;
	}

	const image = await getCompanyImageById(event.company_id);
	const { eventActive, statusMessage, cardColor } = getRegistrationStatus(event);

	return (
		<Link href={`/events/${event.event_id}`}>
			{!isExternal && (
				<RegistrationStatusBanner
					show={eventActive}
					statusMessage={statusMessage}
					cardColor={cardColor}
				/>
			)}
			<div
				className={`h-52 overflow-hidden rounded-md border-3 ${cardColor} grid gap-4 md:grid-cols-7`}
			>
				<CompanyImage imageUrl={image?.url} title={event.title} />
				<EventDetails event={event} />
			</div>
		</Link>
	);
}
