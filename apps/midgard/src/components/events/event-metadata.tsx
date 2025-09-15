"use client";

import type { api } from "@workspace/backend/convex/api";
import type { Doc } from "@workspace/backend/convex/dataModel";
import { Button } from "@workspace/ui/components/button";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarDays, Globe, IdCard, MapPin, Users, Utensils } from "lucide-react";
import { humanReadableDateTime } from "@/utils/dateFormatting";
import QRCode from "./registration/qr-code";
import RegistrationButton from "./registration/registration-button";
import WaitlistPosition from "./registration/waitlist-position";

export function EventMetadata({
	preloadedEvent,
	preloadedRegistrations,
}: Readonly<{
	preloadedEvent: Preloaded<typeof api.events.getById>;
	preloadedRegistrations: Preloaded<typeof api.registration.getByEventId>;
}>) {
	const event = usePreloadedQuery(preloadedEvent);
	const registrations = usePreloadedQuery(preloadedRegistrations);

	const availableSpots = event.participationLimit - (registrations.registered.length || 0);

	return (
		<div>
			<div className='grid h-80 grid-cols-2 grid-rows-3 items-center justify-start gap-4 hyphens-auto rounded-xl bg-primary px-10 py-6 text-primary-foreground md:px-16 md:py-8 dark:text-primary-foreground'>
				<p className='flex items-center gap-2 text-pretty font-semibold md:text-lg'>
					<CalendarDays className='size-6 min-w-6 md:size-8' />{" "}
					{humanReadableDateTime(new Date(event.eventStart))}
				</p>
				<p className='flex items-center gap-2 font-semibold md:text-lg'>
					<MapPin className='size-6 min-w-6 md:size-8' /> {event.location}
				</p>
				<p className='flex items-center gap-2 font-semibold md:text-lg'>
					<Utensils className='size-6 min-w-6 md:size-8' /> {event.food}
				</p>
				<p className='flex items-center gap-2 font-semibold md:text-lg'>
					<Users className='size-6 min-w-6 md:size-8' /> {`${availableSpots} plasser igjen`}
				</p>
				<p className='flex items-center gap-2 font-semibold md:text-lg'>
					<Globe className='size-6 min-w-6 md:size-8' /> {event.language}
				</p>
				<p className='flex items-center gap-2 break-words font-semibold md:text-lg'>
					<IdCard className='size-6 min-w-6 md:size-8' /> {event.ageRestriction}
				</p>
			</div>

			<div className='-mt-6 mb-6 flex justify-center'>
				<EventActionButton event={event} registrations={registrations} />
			</div>

			<WaitlistPosition className='mb-6' registrations={registrations} />

			{event.eventStart - Date.now() < 60 * 60 * 1000 &&
				Date.now() - event.eventStart < 60 * 60 * 1000 && (
					<QRCode className='mb-6' registrations={registrations} />
				)}
		</div>
	);
}

export function EventActionButton({
	event,
	registrations,
}: Readonly<{
	event: Doc<"events">;
	registrations: FunctionReturnType<typeof api.registration.getByEventId>;
}>) {
	const availableSpots = event.participationLimit - (registrations.registered.length || 0);

	if (event.externalUrl && event.externalUrl.length > 0) {
		return (
			<Button
				type='button'
				className="min-h-fit w-4/5 whitespace-normal text-balance rounded-xl bg-orange-500 py-4 text-center text-lg hover:cursor-pointer hover:bg-orange-600 sm:w-3/5 sm:py-6 dark:bg-orange-400"
				asChild
			>
				<a href={event.externalUrl} target='_blank' rel='noopener noreferrer'>
					Gå til arrangementets nettsted
				</a>
			</Button>
		);
	}

	if (event.registrationOpens > Date.now()) {
		return (
			<Button
				type='button'
				className='min-h-fit w-3/4 whitespace-normal text-balance rounded-xl bg-zinc-500 text-lg hover:cursor-pointer hover:bg-zinc-500 sm:py-6 md:py-8 dark:bg-zinc-700 dark:text-primary-foreground'
			>
				Påmelding åpner {humanReadableDateTime(new Date(event.registrationOpens))}
			</Button>
		);
	}

	return (
		<RegistrationButton
			eventId={event._id}
			registration={registrations}
			availableSpots={availableSpots}
			editRegistrationDisabled={Date.now() - event.eventStart >= 60 * 60 * 1000}
		/>
	);
}
